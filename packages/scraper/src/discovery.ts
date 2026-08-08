import { BrowserManager } from "./browser";
import { DiscoveredBusiness, DiscoveryTarget, ScraperConfig, WebsitePresenceCheck } from "./types";

const SEARCH_PATTERN = (target: DiscoveryTarget) =>
  `${target.categoryKeywords.join(" OR ")} in ${target.location}`;

const LIKELY_SOCIAL_PATTERNS = [
  { platform: "facebook", regex: /facebook\.com\/[a-zA-Z0-9._-]+/ },
  { platform: "instagram", regex: /instagram\.com\/[a-zA-Z0-9._]+/ },
  { platform: "linkedin", regex: /linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+/ },
  { platform: "tiktok", regex: /tiktok\.com\/@[a-zA-Z0-9._]+/ },
];

const LIKELY_SOCIAL_SUFFIX = [
  { platform: "facebook", suffix: "facebook.com", urlPattern: (handle: string) => `https://facebook.com/${handle}` },
  { platform: "instagram", suffix: "instagram.com", urlPattern: (handle: string) => `https://instagram.com/${handle}` },
];

export class BusinessDiscoverer {
  private readonly browser: BrowserManager;

  constructor(config: ScraperConfig = {}) {
    this.browser = new BrowserManager(config);
  }

  async discover(target: DiscoveryTarget): Promise<DiscoveredBusiness[]> {
    const page = await this.browser.newPage();
    const results: DiscoveredBusiness[] = [];

    try {
      const query = SEARCH_PATTERN(target);
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
      });

      await this.handleConsentPage(page);
      await page.waitForTimeout(2500);

      const html = await page.content();
      const isCaptcha = /unusual traffic|captcha|I'm not a robot/i.test(html);
      if (isCaptcha) {
        throw new Error("Google blocked the request (CAPTCHA). Consider using a residential proxy or the Maps-API path.");
      }

      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        return anchors
          .map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: (a.textContent ?? "").trim(),
          }))
          .filter((l) => l.href && l.text.length > 2);
      });

      for (const link of links) {
        let url: URL;
        try {
          url = new URL(link.href);
        } catch {
          continue;
        }

        const isSearchResult = !url.hostname.includes("google.com") && !url.hostname.includes("gstatic.com");

        if (!isSearchResult) continue;

        const social = LIKELY_SOCIAL_PATTERNS.find((p) => p.regex.test(url.href));
        if (social) {
          const existing = results.find((r) => r.name.toLowerCase() === link.text.toLowerCase());
          if (existing) {
            if (!existing.socialProfiles.some((s) => s.url === url.href)) {
              existing.socialProfiles.push({ platform: social.platform, url: url.href });
            }
          } else {
            results.push({
              name: link.text || url.hostname,
              category: target.category,
              socialProfiles: [{ platform: social.platform, url: url.href }],
              source: url.href,
            });
          }
        }
      }

      return this.dedupeAndFilter(results);
    } finally {
      await page.close();
    }
  }

  private async handleConsentPage(page: import("playwright").Page) {
    try {
      const consentSelectors = [
        'button[aria-label*="Accept all"]',
        'button[aria-label*="Accept"]',
        '#L2AGLb',
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
      ];
      for (const sel of consentSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count()) {
          await btn.click({ timeout: 3000 }).catch(() => {});
          return;
        }
      }
    } catch {
      // no consent page
    }
  }

  async checkWebsitePresence(name: string): Promise<WebsitePresenceCheck> {
    const page = await this.browser.newPage();
    try {
      const query = `${name} official website`;
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: "domcontentloaded",
      });

      const result = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const domains = anchors
          .map((a) => {
            try {
              const u = new URL(a.href);
              return { domain: u.hostname.replace(/^www\./, ""), href: u.href };
            } catch {
              return null;
            }
          })
          .filter(
            (r): r is { domain: string; href: string } =>
              !!r &&
              !["google.com", "googleusercontent.com"].includes(r.domain) &&
              !r.domain.endsWith("google.com")
          );

        return domains.slice(0, 5);
      });

      const socialDomains = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "yelp.com", "tripadvisor.com"];
      const realSite = result.find((r) => !socialDomains.includes(r.domain));

      return {
        name,
        hasWebsite: !!realSite,
        websiteUrl: realSite?.href,
        confidence: realSite ? 0.9 : 0.7,
      };
    } finally {
      await page.close();
    }
  }

  async findAllWithoutWebsites(target: DiscoveryTarget): Promise<DiscoveredBusiness[]> {
    const discovered = await this.discover(target);
    const withoutWebsites: DiscoveredBusiness[] = [];

    for (const biz of discovered) {
      const check = await this.checkWebsitePresence(biz.name);
      if (!check.hasWebsite) {
        withoutWebsites.push(biz);
      }
      await this.sleep(1500);
    }

    return withoutWebsites;
  }

  private dedupeAndFilter(results: DiscoveredBusiness[]): DiscoveredBusiness[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async close() {
    await this.browser.close();
  }
}
