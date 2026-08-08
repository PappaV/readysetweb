import { AutopilotEngine } from "@demo-site-generator/autopilot";
import { BusinessCategory } from "@demo-site-generator/shared";
import { ProviderConfig } from "@demo-site-generator/outreach";

const required = ["DEEPSEEK_API_KEY", "GCP_PLACES_API_KEY", "DEPLOY_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const CATEGORY_TARGETS: { category: BusinessCategory; keywords: string[]; locations: string[] }[] = [
  {
    category: "medspa",
    keywords: ["med spa", "aesthetics clinic"],
    locations: ["Cape Town, South Africa", "Johannesburg, South Africa", "Durban, South Africa"],
  },
  {
    category: "boutique-hospitality",
    keywords: ["boutique hotel", "guesthouse"],
    locations: ["Cape Town, South Africa", "Franschhoek, South Africa", "Hermanus, South Africa"],
  },
  {
    category: "guesthouse-lodge",
    keywords: ["guesthouse", "lodge", "bed and breakfast"],
    locations: ["Kruger National Park, South Africa", "Drakensberg, South Africa", "Garden Route, South Africa"],
  },
  {
    category: "real-estate-agent",
    keywords: ["real estate agent"],
    locations: ["Cape Town, South Africa", "Johannesburg, South Africa"],
  },
];

// Email/WhatsApp delivery config (used to send the demo and run follow-ups)
let outreach: { config: ProviderConfig; senderName: string; senderCompany: string } | undefined;
if (process.env.OUTREACH_FROM_EMAIL && process.env.OUTREACH_SENDER_NAME) {
  outreach = {
    config:
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
          },
    senderName: process.env.OUTREACH_SENDER_NAME,
    senderCompany: process.env.OUTREACH_SENDER_COMPANY ?? "SiteCraft",
  };
}

const engine = new AutopilotEngine({
  deepseekApiKey: process.env.DEEPSEEK_API_KEY!,
  placesApiKey: process.env.GCP_PLACES_API_KEY!,
  deployToken: process.env.DEPLOY_TOKEN!,
  deployProvider: (process.env.DEPLOY_PROVIDER ?? "netlify") as "netlify" | "vercel",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
  telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID!,
  storeFilePath: process.env.AUTOPILOT_STORE ?? "./data/autopilot.json",
  cycleIntervalMs: Number(process.env.AUTOPILOT_CYCLE_MS ?? 3_600_000),
  maxPerCycle: Number(process.env.AUTOPILOT_MAX_PER_CYCLE ?? 3),
  maxDailyCostUSD: Number(process.env.AUTOPILOT_MAX_DAILY_COST ?? 2),
  apiUrl: process.env.AUTOPILOT_API_URL,
  mode: (process.env.AUTOPILOT_MODE ?? "review") as "review" | "auto",
  maxDailySearches: Number(process.env.AUTOPILOT_MAX_DAILY_SEARCHES ?? 80),
  discoveryCacheTtlMs: Number(process.env.AUTOPILOT_DISCOVERY_CACHE_MS ?? 12 * 3600_000),
  heroVideoDir: process.env.HERO_VIDEO_DIR,
  outreach,
  whatsapp:
    process.env.ULTRA_MSG_INSTANCE_ID && process.env.ULTRA_MSG_API_TOKEN
      ? {
          instanceId: process.env.ULTRA_MSG_INSTANCE_ID,
          apiToken: process.env.ULTRA_MSG_API_TOKEN,
        }
      : undefined,
  followUpDay1: Number(process.env.AUTOPILOT_FOLLOWUP_DAY1 ?? 1),
  followUpDay2: Number(process.env.AUTOPILOT_FOLLOWUP_DAY2 ?? 3),
  breakupDay: Number(process.env.AUTOPILOT_BREAKUP_DAY ?? 7),
  targets: CATEGORY_TARGETS,
});

console.log(`Autopilot 24/7 engine starting (mode: ${engine.mode})...`);
engine.start();

process.on("SIGINT", () => {
  console.log("Stopping autopilot...");
  engine.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  engine.stop();
  process.exit(0);
});
