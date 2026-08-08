import express from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { BusinessCategorySchema, MAINTENANCE_TIERS } from "@demo-site-generator/shared";
import { z } from "zod";
import { createJob, getJob, listJobs, updateJob } from "./store";
import { GenerationOrchestrator } from "./orchestrator";
import { PaymentClient, PaymentEvent, PayFastSubscriptions } from "@demo-site-generator/payments";
import { TelegramBot, ApprovalBot } from "@demo-site-generator/telegram";
import { EmailSender } from "@demo-site-generator/outreach";
import { ContentGenerator } from "@demo-site-generator/content-ai";
import { ConversationStore } from "./conversations";
import { SupportManager } from "./support";
import { SalesStore } from "./sales";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  console.error("DEEPSEEK_API_KEY not set");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

// CORS — the demo sites live on Netlify/Vercel and call this API from the browser
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const paymentClient = process.env.PAYMENT_PROVIDER
  ? new PaymentClient(
      process.env.PAYMENT_PROVIDER === "paystack"
        ? {
            provider: "paystack",
            config: { secretKey: process.env.PAYSTACK_SECRET_KEY ?? "" },
          }
        : {
            provider: "payfast",
            config: {
              merchantId: process.env.PAYFAST_MERCHANT_ID ?? "",
              merchantKey: process.env.PAYFAST_MERCHANT_KEY ?? "",
              passphrase: process.env.PAYFAST_PASSPHRASE,
              sandbox: process.env.PAYFAST_SANDBOX !== "false",
            },
          }
    )
  : null;

// Recurring subscription management via PayFast API
const subscriptionClient =
  process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_API_TOKEN
    ? new PayFastSubscriptions({
        merchantId: process.env.PAYFAST_MERCHANT_ID,
        apiToken: process.env.PAYFAST_API_TOKEN,
        sandbox: process.env.PAYFAST_SANDBOX !== "false",
      })
    : null;

const orchestrator = new GenerationOrchestrator({
  apiKey,
  placesApiKey: process.env.GCP_PLACES_API_KEY,
  deploy: process.env.DEPLOY_TOKEN
    ? {
        provider: (process.env.DEPLOY_PROVIDER ?? "netlify") as "netlify" | "vercel",
        token: process.env.DEPLOY_TOKEN,
        siteName: process.env.DEPLOY_SITE_NAME,
      }
    : undefined,
  outreach:
    process.env.OUTREACH_FROM_EMAIL && process.env.OUTREACH_SENDER_NAME
      ? {
          provider: (process.env.OUTREACH_PROVIDER ?? "resend") as "resend" | "smtp",
          fromEmail: process.env.OUTREACH_FROM_EMAIL,
          fromName: process.env.OUTREACH_FROM_NAME,
          apiKey: process.env.RESEND_API_KEY,
          smtp: process.env.SMTP_HOST
            ? {
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT ?? 587),
                secure: process.env.SMTP_SECURE === "true",
                user: process.env.SMTP_USER ?? "",
                pass: process.env.SMTP_PASS ?? "",
              }
            : undefined,
          senderName: process.env.OUTREACH_SENDER_NAME,
          senderCompany: process.env.OUTREACH_SENDER_COMPANY ?? "Site Craft",
        }
      : undefined,
});

// --- Client communication (widget + email) ---
// (defined after telegramBot so it can be wired into polling below)
// --- Telegram approval bot ---
const telegramBot =
  process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID
    ? new TelegramBot({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
      })
    : null;

let approvalBot: ApprovalBot | null = null;
let approvalHandlers: {
  onDecision: (jobId: string, action: "approve" | "reject" | "regenerate", cb: string) => Promise<void>;
  onReject: (jobId: string, cb: string) => Promise<void>;
  onRegenerate: (jobId: string, cb: string) => Promise<void>;
} | null = null;

if (telegramBot) {
  approvalBot = new ApprovalBot(telegramBot);

  const approve = async (jobId: string, _callbackQueryId: string) => {
    try {
      const result = await orchestrator.approve(jobId);
      const url = result.deployedUrl ?? "no URL";
      await telegramBot.send({
        text: `✅ <b>Approved ${jobId}</b>\n\nSite is live: ${url}\nDemo sent to the business owner.`,
        parseMode: "HTML",
      });
    } catch (err) {
      await telegramBot.send({ text: `❌ Approve failed for ${jobId}: ${(err as Error).message}` });
    }
  };

  const reject = async (jobId: string, _callbackQueryId: string) => {
    try {
      await orchestrator.reject(jobId);
      await telegramBot.send({ text: `❌ Rejected ${jobId}. No email was sent.` });
    } catch (err) {
      await telegramBot.send({ text: `⚠️ Reject failed for ${jobId}: ${(err as Error).message}` });
    }
  };

  const regenerate = async (jobId: string, _callbackQueryId: string) => {
    try {
      const result = await orchestrator.regenerate(jobId);
      await telegramBot.send({
        text: `🔄 Regenerated ${jobId}. New preview:\n${result.previewUrl ?? "no preview URL"}\n\nReview it and choose:`,
      });
    } catch (err) {
      await telegramBot.send({ text: `⚠️ Regenerate failed for ${jobId}: ${(err as Error).message}` });
    }
  };

  approvalHandlers = { onDecision: approve, onReject: reject, onRegenerate: regenerate };

  // NOTE: this bot does NOT poll Telegram. The autopilot owns the single
  // getUpdates poller; it forwards non-autopilot updates here via
  // POST /api/support/telegram. Polling twice on the same bot token
  // causes 409 conflicts and broken buttons.
  console.log("Telegram bot ready (updates delivered via autopilot forwarding)");
} else {
  console.log("Telegram bot not configured — skipping approval notifications");
}

// --- Client communication (widget + email) ---
const conversationStore = new ConversationStore(
  process.env.CONVERSATIONS_STORE ?? resolve(__dirname, "..", "data", "conversations.json")
);

const supportEmail =
  process.env.OUTREACH_FROM_EMAIL && (process.env.RESEND_API_KEY || process.env.SMTP_HOST)
    ? new EmailSender(
        process.env.OUTREACH_PROVIDER === "smtp"
          ? {
              provider: "smtp",
              config: {
                host: process.env.SMTP_HOST ?? "",
                port: Number(process.env.SMTP_PORT ?? 587),
                secure: process.env.SMTP_SECURE === "true",
                user: process.env.SMTP_USER ?? "",
                pass: process.env.SMTP_PASS ?? "",
                fromEmail: process.env.OUTREACH_FROM_EMAIL,
                fromName: process.env.OUTREACH_FROM_NAME,
              },
            }
          : {
              provider: "resend",
              config: {
                apiKey: process.env.RESEND_API_KEY ?? "",
                fromEmail: process.env.OUTREACH_FROM_EMAIL,
                fromName: process.env.OUTREACH_FROM_NAME,
              },
            }
      )
    : undefined;

const supportManager = new SupportManager({
  conversations: conversationStore,
  contentGen: new ContentGenerator({ apiKey }),
  telegram: telegramBot ?? undefined,
  email: supportEmail,
});

// --- Pending sales (payment-gated go-live) ---
const salesStore = new SalesStore(process.env.SALES_STORE ?? resolve(__dirname, "..", "data", "sales.json"));

// When a payment triggers go-live, also update the shared autopilot lead store
// so the dashboard shows the deal as delivered. (The store is a plain JSON file.)
function markLeadDelivered(leadId: string | undefined, deployedUrl?: string) {
  if (!leadId) return;
  try {
    const storePath = process.env.AUTOPILOT_STORE;
    if (!storePath) return;
    const data = JSON.parse(readFileSync(storePath, "utf-8"));
    if (data?.leads?.[leadId]) {
      data.leads[leadId].status = "delivered";
      data.leads[leadId].deployedUrl = deployedUrl;
      data.leads[leadId].updatedAt = new Date().toISOString();
      writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch {
    // best effort — autopilot store may be elsewhere
  }
}

/** Propose the client's custom domain (only created after payment). */
function proposeDomain(businessName: string): string {
  return businessName.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/(^a-z|^)/, "").slice(0, 40) + ".co.za";
}

/** After payment + go-live, set up the domain + professional email workflow. */
async function provisionClientIdentity(sale: ReturnType<typeof salesStore.get> | undefined) {
  if (!sale || sale.status !== "live") return;
  if (sale.domain && sale.domainStatus === "live") return;
  const domain = sale.domain ?? proposeDomain(sale.businessName);
  const professionalEmail = sale.professionalEmail ?? `info@${domain}`;
  salesStore.update(sale.businessId, {
    domain,
    domainStatus: "pending-provision",
    professionalEmail,
  });
  await telegramBot?.send({
    text:
      `🌐 <b>Client paid — provision their domain + email</b>\n\n` +
      `🏢 ${sale.businessName}\n` +
      `🌐 Domain: <b>${domain}</b>\n` +
      `📧 Email: <b>${professionalEmail}</b>\n\n` +
      `Steps: 1) Buy the domain 2) Point DNS to the live site 3) Create the email mailbox 4) Set SITE_DOMAIN for this site.\n\n` +
      `Reply <b>/domaindone ${sale.businessId}</b> when done.`,
    parseMode: "HTML",
  }).catch(() => {});
}

const RegisterSaleSchema = z.object({
  businessId: z.string().min(1),
  businessName: z.string().min(1),
  category: BusinessCategorySchema,
  businessData: z.unknown(),
  previewUrl: z.string().url().optional(),
  leadId: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

app.post("/api/sales/register", async (req, res) => {
  try {
    const parsed = RegisterSaleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const sale = salesStore.upsert({
      businessId: parsed.data.businessId,
      businessName: parsed.data.businessName,
      category: parsed.data.category,
      businessData: parsed.data.businessData,
      previewUrl: parsed.data.previewUrl,
      leadId: parsed.data.leadId,
      contactEmail: parsed.data.contactEmail,
      status: "preview",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true, status: sale.status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/sales", (_req, res) => {
  res.json(salesStore.getAll());
});

app.get("/api/sales/:businessId", (req, res) => {
  const sale = salesStore.get(req.params.businessId);
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  res.json(sale);
});

// Admin: manually publish a sale to production (before or after payment)
app.post("/api/sales/:businessId/go-live", async (req, res) => {
  try {
    const sale = salesStore.get(req.params.businessId);
    if (!sale) return res.status(404).json({ error: "Sale not found" });
    const url = await orchestrator.publishBusiness(sale.businessData as { name: string; category: string });
    salesStore.update(sale.businessId, { status: "live", deployedUrl: url });
    markLeadDelivered(sale.leadId, url);
    await telegramBot?.send({ text: `🚀 <b>Site published to production</b>\n\n🏢 ${sale.businessName}\n🔗 ${url}` , parseMode: "HTML" }).catch(() => {});
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// AI visitor chatbot — answers site visitors from the business's own data
const chatContentGen = new ContentGenerator({ apiKey });

const ChatBodySchema = z.object({
  businessId: z.string().min(1),
  question: z.string().min(1).max(500),
  history: z.array(z.object({ role: z.enum(["visitor", "bot"]), text: z.string() })).optional(),
});

app.post("/api/chat", async (req, res) => {
  try {
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    const sale = salesStore.get(parsed.data.businessId);
    if (!sale?.businessData) return res.status(404).json({ error: "Business not found" });
    const answer = await chatContentGen.chatAnswer({
      business: sale.businessData as never,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const GenerateBodySchema = z.object({
  businessName: z.string().min(1),
  category: BusinessCategorySchema,
  socialUrls: z.array(z.string().url()).max(3).optional(),
  rawSocialData: z.string().max(50000).optional(),
  location: z.string().optional(),
  discoverLocation: z.string().optional(),
  discoverKeywords: z.array(z.string()).optional().default([]),
  contactEmail: z.string().email().optional(),
  /** Real scraped photo URLs used to build the hero + gallery (unique per site). */
  gallery: z.array(z.string().url()).max(12).optional(),
});

app.post("/api/generate", async (req, res) => {
  try {
    const parsed = GenerateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }

    const job = createJob(crypto.randomUUID());
    res.json({ jobId: job.id, status: "started" });

    orchestrator
      .run(job.id, parsed.data)
      .then(async (result) => {
        console.log(`[job ${job.id}] awaiting approval. preview=${result.previewUrl}`);

        if (telegramBot) {
          const biz = result.businessData as { name: string; category: string };
          await telegramBot.send({
            text:
              `<b>New website ready for review</b>\n\n` +
              `🏢 ${biz.name} (${biz.category.replace(/-/g, " ")})\n` +
              `💰 Cost: $${result.costUSD?.toFixed(4)}\n\n` +
              `Preview: ${result.previewUrl ?? "no preview URL"}\n\n` +
              `Review the site, then choose:`,
            parseMode: "HTML",
            buttons: [
              { text: "✅ Approve", callbackData: `approval:${job.id}:approve` },
              { text: "❌ Reject", callbackData: `approval:${job.id}:reject` },
              { text: "🔄 Regenerate", callbackData: `approval:${job.id}:regenerate` },
            ],
          });
        }
      })
      .catch((err) => {
        console.error(`[job ${job.id}] failed:`, err.message);
        updateJob(job.id, { status: "failed", currentStep: (err as Error).message });
      });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Manual approve/reject endpoints (as a fallback to Telegram buttons)
app.post("/api/jobs/:id/approve", async (req, res) => {
  try {
    const result = await orchestrator.approve(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/jobs/:id/reject", async (req, res) => {
  try {
    await orchestrator.reject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/jobs/:id/regenerate", async (req, res) => {
  try {
    const result = await orchestrator.regenerate(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/api/jobs", (_req, res) => {
  res.json(listJobs());
});

const CheckoutBodySchema = z.object({
  orderId: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(["ZAR", "USD", "NGN"]).default("ZAR"),
  buyerEmail: z.string().email().optional(),
  buyerName: z.string().optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

app.post("/api/payments/checkout", async (req, res) => {
  if (!paymentClient) {
    return res.status(400).json({ error: "Payment provider not configured" });
  }
  try {
    const parsed = CheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }

    const webhookUrl = process.env.PUBLIC_BASE_URL
      ? `${process.env.PUBLIC_BASE_URL}/api/payments/webhook`
      : undefined;

    const checkout = await paymentClient.createCheckout({
      orderId: parsed.data.orderId,
      description: parsed.data.description,
      amount: { amount: parsed.data.amount, currency: parsed.data.currency },
      buyerEmail: parsed.data.buyerEmail,
      buyerName: parsed.data.buyerName,
      returnUrl: parsed.data.returnUrl ?? `${process.env.PUBLIC_BASE_URL ?? ""}/payment/success`,
      cancelUrl: parsed.data.cancelUrl ?? `${process.env.PUBLIC_BASE_URL ?? ""}/payment/cancel`,
      webhookUrl,
    });

    if (checkout.formHtml) {
      res.type("html").send(checkout.formHtml);
    } else {
      res.json(checkout);
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const SubscriptionBodySchema = z.object({
  orderId: z.string().min(1),
  description: z.string().min(1),
  signupAmount: z.number().positive().optional(),
  recurringAmount: z.number().positive().optional(),
  frequency: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  billingDate: z.string().optional(),
  buyerEmail: z.string().email().optional(),
  buyerName: z.string().optional(),
  tier: z.enum(["starter", "growth", "premium"]).optional(),
});

// Maintenance plan subscription checkout (one-off signup + recurring monthly)
app.post("/api/payments/subscription", async (req, res) => {
  if (!paymentClient) {
    return res.status(400).json({ error: "Payment provider not configured" });
  }
  try {
    const parsed = SubscriptionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }

    let recurringAmount = parsed.data.recurringAmount;
    let signupAmount = parsed.data.signupAmount;
    let description = parsed.data.description;

    // If a tier is specified, use the tier config
    if (parsed.data.tier) {
      const tier = MAINTENANCE_TIERS.find((t) => t.id === parsed.data.tier);
      if (tier) {
        recurringAmount = tier.priceMonthly;
        description = `${tier.name} Maintenance Plan — ${parsed.data.description}`;
        signupAmount = parsed.data.signupAmount ?? tier.priceMonthly;
      }
    }

    if (!recurringAmount) {
      return res.status(400).json({ error: "recurringAmount or tier is required" });
    }

    const webhookUrl = process.env.PUBLIC_BASE_URL
      ? `${process.env.PUBLIC_BASE_URL}/api/payments/webhook`
      : undefined;

    const checkout = await paymentClient.createCheckout({
      orderId: parsed.data.orderId,
      description,
      amount: {
        amount: signupAmount ?? recurringAmount,
        currency: "ZAR",
      },
      buyerEmail: parsed.data.buyerEmail,
      buyerName: parsed.data.buyerName,
      returnUrl: `${process.env.PUBLIC_BASE_URL ?? ""}/payment/success`,
      cancelUrl: `${process.env.PUBLIC_BASE_URL ?? ""}/payment/cancel`,
      webhookUrl,
      recurring: {
        amount: recurringAmount,
        frequency: parsed.data.frequency,
        ...(parsed.data.billingDate ? { billingDate: parsed.data.billingDate } : {}),
      },
    });

    if (checkout.formHtml) {
      res.type("html").send(checkout.formHtml);
    } else {
      res.json(checkout);
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/plans", (_req, res) => {
  res.json(MAINTENANCE_TIERS);
});

app.get("/api/subscriptions", async (_req, res) => {
  if (!subscriptionClient) {
    return res.status(400).json({ error: "PayFast API token not configured" });
  }
  try {
    const subs = await subscriptionClient.listSubscriptions();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/api/subscriptions/:id", async (req, res) => {
  if (!subscriptionClient) {
    return res.status(400).json({ error: "PayFast API token not configured" });
  }
  try {
    await subscriptionClient.cancelSubscription(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/payments/webhook", async (req, res) => {
  if (!paymentClient) {
    return res.status(400).json({ error: "Payment provider not configured" });
  }
  try {
    const event: PaymentEvent = paymentClient.handleWebhook(req.body, {
      "x-paystack-signature": String(req.headers["x-paystack-signature"] ?? ""),
    });

    console.log(`[payment] ${event.eventType} order=${event.orderId} ref=${event.reference} amount=${event.amount} ${event.currency}`);

    if (event.eventType === "payment.success") {
      const job = getJob(event.orderId);
      if (job && job.status === "completed") {
        updateJob(job.id, {
          currentStep: "Payment received — site ready for delivery",
          siteConfig: { ...(job.siteConfig ?? {}), paid: true },
        });
      }

      // Payment-gated go-live: a successful payment for a demo site publishes it
      const sale = salesStore.get(event.orderId);
      if (sale && sale.status !== "live") {
        try {
          salesStore.update(sale.businessId, { status: "paid" });
          const url = await orchestrator.publishBusiness(sale.businessData as { name: string; category: string });
          salesStore.update(sale.businessId, { status: "live", deployedUrl: url });
          markLeadDelivered(sale.leadId, url);
          await provisionClientIdentity(sale);
          await telegramBot?.send({
            text:
              `💳 <b>Payment received — site is now LIVE</b>\n\n` +
              `🏢 ${sale.businessName}\n` +
              `💰 ${event.amount.toFixed(2)} ${event.currency}\n` +
              `🔗 ${url}\n\n` +
              `The client's website is published. Send them the good news.`,
            parseMode: "HTML",
          }).catch(() => {});
          if (sale.contactEmail && supportEmail) {
            const portalUrl = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/portal/${sale.businessId}` : undefined;
            await supportEmail.send(
              sale.contactEmail,
              `Your website is live 🎉`,
              `Hi,\n\nGreat news — we've received your payment and your website for ${sale.businessName} is now live:\n\n${url}\n\n` +
              (portalUrl ? `You can manage your site and request changes anytime here:\n${portalUrl}\n\n` : "") +
              `Your custom domain and professional email are being set up and we'll let you know the moment they're ready.\n\n` +
              `If you'd like any changes, just reply to this email and we'll take care of it.\n\nBest regards`
            ).catch(() => {});
          }
        } catch (err) {
          salesStore.update(sale.businessId, { status: "failed" });
          await telegramBot?.send({ text: `⚠️ Go-live failed for ${sale.businessName}: ${(err as Error).message}` }).catch(() => {});
        }
      }

      // Notify on subscriptions (start or monthly renewal)
      if (event.subscriptionId && telegramBot) {
        const isRenewal = !event.isSubscriptionStart;
        await telegramBot.send({
          text:
            (isRenewal ? `💳 <b>Subscription renewal</b>` : `🎉 <b>New subscription started</b>`) +
            `\n\n` +
            `Order: ${event.orderId}\n` +
            `Amount: R${event.amount.toFixed(2)}\n` +
            `Subscription: ${event.subscriptionId}\n` +
            (isRenewal ? `\nMonthly income secured ✅` : `\nClient on recurring maintenance plan ✅`),
          parseMode: "HTML",
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[payment] webhook rejected:", (err as Error).message);
    res.status(400).json({ error: (err as Error).message });
  }
});

const ConversationIngestSchema = z.object({
  businessId: z.string().optional(),
  businessName: z.string().min(1),
  leadId: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  text: z.string().min(1).max(2000),
  category: BusinessCategorySchema.optional(),
});

app.post("/api/conversations/ingest", async (req, res) => {
  try {
    const parsed = ConversationIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    await supportManager.ingest({ ...parsed.data, channel: "widget" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/conversations", (_req, res) => {
  res.json(conversationStore.getAllConversations());
});

app.get("/api/conversations/by-business/:businessId", (req, res) => {
  const conv = conversationStore
    .getAllConversations()
    .find((c) => c.businessId === req.params.businessId);
  if (!conv) return res.json({ conversation: null, messages: [] });
  const messages = conversationStore
    .getMessages(conv.id)
    .filter((m) => m.direction === "client" || (m.direction === "admin" && m.status === "sent"))
    .map((m) => ({ id: m.id, direction: m.direction, text: m.text, createdAt: m.createdAt }));
  res.json({ conversation: conv, messages });
});

app.get("/api/conversations/:id", (req, res) => {
  const conv = conversationStore.get(req.params.id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  // Widget-facing: client's own messages + admin replies that were actually sent
  const messages = conversationStore
    .getMessages(conv.id)
    .filter((m) => m.direction === "client" || (m.direction === "admin" && m.status === "sent"))
    .map((m) => ({ id: m.id, direction: m.direction, text: m.text, createdAt: m.createdAt }));
  res.json({ conversation: conv, messages });
});

// Resend inbound email webhook → route to a conversation as a client message
app.post("/api/email/inbound", async (req, res) => {
  try {
    const body = req.body ?? {};
    const from = (body.from ?? "") as string;
    const subject = (body.subject ?? "") as string;
    const text = ((body.text ?? body.body ?? "") as string).trim();
    const fromEmail = from.replace(/^.*<|>.*$/g, "").trim();

    if (!fromEmail || !text) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const businessName = subject.split(/[-–—]/)[0]?.trim() || "Website enquiry";
    await supportManager.ingest({
      businessName,
      clientEmail: fromEmail,
      clientName: from,
      text,
      channel: "email",
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[email/inbound] error:", (err as Error).message);
    res.status(200).json({ ok: true, ignored: true });
  }
});

// Autopilot forwards non-autopilot Telegram updates (support replies, /reply
// commands, reply: callbacks) here. The autopilot owns the only poller.
app.post("/api/support/telegram", async (req, res) => {
  try {
    const update = req.body ?? {};
    // /domaindone <businessId> — mark client domain+email provisioning complete
    if (update.message?.text?.startsWith("/domaindone")) {
      const id = update.message.text.split(" ")[1];
      if (id && salesStore.get(id)) {
        salesStore.update(id, { domainStatus: "live" });
        await telegramBot?.send({ text: `✅ Domain + email for ${salesStore.get(id)?.businessName} marked live.` }).catch(() => {});
      }
      return res.json({ ok: true, handled: true });
    }
    let handled = false;
    if (approvalBot && approvalHandlers) {
      handled = await approvalBot.handleUpdate(update, approvalHandlers as any);
    }
    if (!handled) {
      await supportManager.handleTelegram(update as any);
    }
    res.json({ ok: true, handled });
  } catch (err) {
    console.error("[support/telegram] error:", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
});

const LeadBodySchema = z.object({
  businessName: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  date: z.string().optional(),
  page: z.string().optional(),
});

const leadStore: Record<string, unknown>[] = [];

app.post("/api/leads", async (req, res) => {
  try {
    const parsed = LeadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }

    const lead = {
      ...parsed.data,
      capturedAt: new Date().toISOString(),
    };
    leadStore.push(lead);

    // Forward to Telegram for instant notification
    if (telegramBot) {
      const lines = [
        `<b>🎯 New lead captured</b>`,
        ``,
        parsed.data.businessName ? `🏢 ${parsed.data.businessName}` : "",
        parsed.data.type ? `📋 ${parsed.data.type}` : "",
        parsed.data.name ? `👤 ${parsed.data.name}` : "",
        parsed.data.email ? `📧 ${parsed.data.email}` : "",
        parsed.data.phone ? `📱 ${parsed.data.phone}` : "",
        parsed.data.date ? `📅 ${parsed.data.date}` : "",
        parsed.data.message ? `💬 ${parsed.data.message.slice(0, 200)}` : "",
        parsed.data.page ? `🔗 ${parsed.data.page}` : "",
      ].filter((l) => l !== "");

      await telegramBot.send({ text: lines.join("\n"), parseMode: "HTML" });
    }

    res.json({ ok: true, leadId: leadStore.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/leads", (_req, res) => {
  res.json(leadStore);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "generator-api" });
});

// --- Client portal (token-linked) ---
const PORTAL_HTML = (data: { businessName: string; status: string; previewUrl?: string; deployedUrl?: string; domain?: string; professionalEmail?: string; domainStatus?: string }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Website — ${data.businessName}</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;background:#0b0e13;color:#e2e8f0;margin:0;padding:24px;display:flex;justify-content:center}
.wrap{max-width:560px;width:100%}.card{background:#141b26;border:1px solid #263244;border-radius:16px;padding:28px;margin-top:16px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}
.status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;background:#1e3a5f;color:#93c5fd}
a.btn{display:inline-block;margin-top:8px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#111;font-weight:600;padding:10px 18px;border-radius:10px;text-decoration:none}
textarea{width:100%;background:#0f1520;border:1px solid #2b3b52;color:#e2e8f0;border-radius:10px;padding:12px;min-height:90px;box-sizing:border-box}
button{margin-top:10px;background:#fbbf24;color:#111;border:0;font-weight:600;padding:10px 18px;border-radius:10px;cursor:pointer}
#msg{margin-top:10px;font-size:13px}</style></head><body><div class="wrap">
  <div class="card">
    <span class="status">${data.status === "live" ? "● LIVE" : data.status === "paid" ? "● Payment received" : "● In progress"}</span>
    <h1>${data.businessName}</h1>
    <p style="color:#94a3b8;font-size:14px">Your website is being built and managed for you.</p>
    ${data.previewUrl ? `<a class="btn" href="${data.previewUrl}" target="_blank">View your site</a>` : ""}
    ${data.deployedUrl ? `<p style="margin-top:10px;font-size:13px;color:#34d399">Live at: <a href="${data.deployedUrl}" style="color:#60a5fa">${data.deployedUrl}</a></p>` : ""}
    ${data.domain ? `<div style="margin-top:14px;padding:12px;border-radius:12px;background:#0f1520;border:1px solid #2b3b52;font-size:13px">
      <b style="color:#fbbf24">Your premium package includes:</b><br>
      🌐 Your own domain: <b>${data.domain}</b><br>
      📧 Professional email: <b>${data.professionalEmail}</b><br>
      <span style="color:#94a3b8">${data.domainStatus === "live" ? "✅ Live" : "⏳ Being set up for you — we'll notify you when it's ready."}</span>
    </div>` : ""}
  </div>
  <div class="card">
    <h2>Request a change</h2>
    <p style="color:#94a3b8;font-size:14px">Tell us what you'd like changed on your website — we'll take care of it.</p>
    <textarea id="text" placeholder="e.g. Update our opening hours, add a service, change the phone number…"></textarea>
    <br><button onclick="send()">Send request</button>
    <p id="msg"></p>
  </div>
</div>
<script>async function send(){const t=document.getElementById('text').value.trim();if(!t)return;
const m=document.getElementById('msg');m.textContent='Sending…';
try{await fetch('/api/conversations/ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessName:'${data.businessName}'.replace(/&/g,'&amp;'),text:t,channel:'widget'})});m.textContent='Thank you — we\\'ve received your request.';document.getElementById('text').value='';}
catch(e){m.textContent='Sorry, please try again.'}}</script></body></html>`;

app.get("/portal/:token", (req, res) => {
  const token = req.params.token;
  const sale = salesStore.get(token) || salesStore.getAll().find((s) => s.leadId === token);
  if (!sale) return res.status(404).send("Not found");
  res.send(
    PORTAL_HTML({
      businessName: sale.businessName,
      status: sale.status,
      previewUrl: sale.previewUrl,
      deployedUrl: sale.deployedUrl,
      domain: sale.domain,
      professionalEmail: sale.professionalEmail,
      domainStatus: sale.domainStatus,
    })
  );
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`generator-api listening on http://localhost:${port}`);
});
