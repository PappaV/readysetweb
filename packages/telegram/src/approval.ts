import { TelegramBot } from "./client";

export type ApprovalAction = "approve" | "reject" | "regenerate";

export interface PreviewRequest {
  jobId: string;
  businessName: string;
  category: string;
  previewUrl: string;
  siteUrl?: string;
  costUSD?: number;
  generatedAt?: string;
}

export interface ApprovalHandler {
  onDecision: (jobId: string, action: ApprovalAction, callbackQueryId: string) => Promise<void>;
  onReject: (jobId: string, callbackQueryId: string) => Promise<void>;
  onRegenerate: (jobId: string, callbackQueryId: string) => Promise<void>;
}

const cbPrefix = "approval:";

export class ApprovalBot {
  private readonly bot: TelegramBot;
  private pending = new Map<string, { jobId: string; messageId: number }>();

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  get pendingCount() {
    return this.pending.size;
  }

  async sendForApproval(req: PreviewRequest): Promise<number> {
    const lines = [
      `<b>New website ready for review</b>`,
      ``,
      `🏢 <b>${req.businessName}</b> (${req.category.replace(/-/g, " ")})`,
      req.costUSD !== undefined ? `💰 Cost: $${req.costUSD.toFixed(4)}` : "",
      req.siteUrl ? `🔗 Will go live at: ${req.siteUrl}` : "",
      ``,
      `Preview: ${req.previewUrl}`,
      ``,
      `Review the site, then choose:`,
    ].filter((l) => l !== "").join("\n");

    const { messageId } = await this.bot.send({
      text: lines,
      parseMode: "HTML",
      buttons: [
        { text: "✅ Approve", callbackData: `${cbPrefix}${req.jobId}:approve` },
        { text: "❌ Reject", callbackData: `${cbPrefix}${req.jobId}:reject` },
        { text: "🔄 Regenerate", callbackData: `${cbPrefix}${req.jobId}:regenerate` },
      ],
    });

    this.pending.set(req.jobId, { jobId: req.jobId, messageId });
    return messageId;
  }

  async sendPendingSummary() {
    if (this.pending.size === 0) {
      await this.bot.send({ text: "No sites currently waiting for approval." });
      return;
    }
    const lines = [`<b>Sites waiting for your review:</b>`, ``];
    for (const [jobId] of this.pending) {
      lines.push(`• ${jobId}`);
    }
    await this.bot.send({ text: lines.join("\n"), parseMode: "HTML" });
  }

  async handleUpdate(
    update: {
      callback_query?: {
        id: string;
        from?: { id: number };
        data?: string;
        message?: { message_id: number; chat: { id: number } };
      };
      message?: { chat?: { id: number }; text?: string };
    },
    handlers: ApprovalHandler
  ): Promise<boolean> {
    // Plain text commands
    if (update.message?.text) {
      const text = update.message.text.trim();
      if (text === "/pending") {
        await this.sendPendingSummary();
        return true;
      }
      if (text.startsWith("/approve")) {
        const jobId = text.split(" ")[1];
        if (jobId) {
          await handlers.onDecision(jobId, "approve", "");
          await this.bot.send({ text: `Approved ${jobId} — continuing pipeline.` });
          this.pending.delete(jobId);
          return true;
        }
      }
      if (text.startsWith("/reject")) {
        const jobId = text.split(" ")[1];
        if (jobId) {
          await handlers.onReject(jobId, "");
          await this.bot.send({ text: `Rejected ${jobId} — no email will be sent.` });
          this.pending.delete(jobId);
          return true;
        }
      }
      if (text === "/start" || text === "/help") {
        await this.bot.send({
          text: `Welcome to the SiteCraft bot. I'll send you every generated website for approval before it goes out.

Commands:
/pending — list sites waiting for review
/approve <jobId> — approve a site
/reject <jobId> — reject a site
`,
        });
        return true;
      }
      return false;
    }

    // Button callback
    const cb = update.callback_query;
    if (!cb?.data?.startsWith(cbPrefix)) return false;

    const [, jobId, action] = cb.data.split(":");
    await this.bot.answerCallback(cb.id, `Processing ${action}…`);
    await this.bot.editMessage(
      String(cb.message?.chat.id ?? ""),
      cb.message?.message_id ?? 0,
      `⏳ ${action === "approve" ? "Approving" : action === "reject" ? "Rejecting" : "Regenerating"} ${jobId}…`
    );

    if (action === "approve") {
      await handlers.onDecision(jobId, "approve", cb.id);
    } else if (action === "reject") {
      await handlers.onReject(jobId, cb.id);
    } else if (action === "regenerate") {
      await handlers.onRegenerate(jobId, cb.id);
    }
    this.pending.delete(jobId);
    return true;
  }
}
