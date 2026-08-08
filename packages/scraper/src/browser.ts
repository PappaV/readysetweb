import { Browser, BrowserContext, chromium } from "playwright";
import { ScraperConfig } from "./types";

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly config: Required<Pick<ScraperConfig, "headless" | "timeoutMs" | "userAgent" | "viewport">>;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeoutMs: config.timeoutMs ?? 30_000,
      userAgent: config.userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: config.viewport ?? { width: 1280, height: 800 },
    };
  }

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: this.config.headless });
    }
    if (!this.context) {
      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        viewport: this.config.viewport,
        locale: "en-US",
      });
    }
    return this.context;
  }

  async newPage() {
    const context = await this.init();
    const page = await context.newPage();
    page.setDefaultTimeout(this.config.timeoutMs);
    return page;
  }

  async close() {
    await this.context?.close();
    await this.browser?.close();
    this.context = null;
    this.browser = null;
  }
}
