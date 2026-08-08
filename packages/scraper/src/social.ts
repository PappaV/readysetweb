import { BrowserManager } from "./browser";
import { SocialScrapeResult } from "./types";

export class SocialScraper {
  private readonly browser: BrowserManager;

  constructor(config: { headless?: boolean } = {}) {
    this.browser = new BrowserManager({ headless: config.headless ?? true });
  }

  async scrapeProfile(url: string): Promise<SocialScrapeResult> {
    const hostname = new URL(url).hostname;
    if (hostname.includes("instagram")) return this.scrapeInstagram(url);
    if (hostname.includes("facebook")) return this.scrapeFacebook(url);
    if (hostname.includes("tiktok")) return this.scrapeTikTok(url);
    throw new Error(`Unsupported platform: ${hostname}`);
  }

  private async scrapeInstagram(url: string): Promise<SocialScrapeResult> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(4000);

      const data = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "";

        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers)/);
        const postMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Posts|posts)/);
        const followingMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Following|following)/);

        const images = Array.from(document.querySelectorAll("img[srcset], img"))
          .map((img) => (img as HTMLImageElement).src)
          .filter((src) => src.startsWith("https://"))
          .slice(0, 20);

        const recentPosts = Array.from(document.querySelectorAll('a[href*="/p/"]'))
          .map((a) => ({ url: (a as HTMLAnchorElement).href, text: (a.textContent ?? "").trim() }))
          .filter((p) => p.url.includes("/p/"))
          .slice(0, 12);

        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
        const phoneMatch = text.match(/\+?[\d\s().-]{10,15}/);

        return {
          text,
          metaDescription,
          ogDescription,
          followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined,
          postCount: postMatch ? parseCount(postMatch[1]) : undefined,
          images,
          recentPosts,
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined,
        };
      });

      const bio = data.ogDescription || data.metaDescription || data.text.slice(0, 500);
      return {
        bio,
        followerCount: data.followerCount,
        postCount: data.postCount,
        recentPosts: data.recentPosts.map((p) => ({ text: p.text, url: p.url })),
        email: data.email,
        phone: data.phone,
        rawText: data.text.slice(0, 8000),
        images: data.images,
        profileUrl: url,
      };
    } catch (err) {
      return {
        rawText: "",
        recentPosts: [],
        images: [],
        profileUrl: url,
      };
    } finally {
      await page.close();
    }
  }

  private async scrapeFacebook(url: string): Promise<SocialScrapeResult> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3000);

      const data = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
        const phoneMatch = text.match(/\+?[\d\s().-]{10,15}/);
        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers|people follow this)/);

        return {
          text,
          metaDescription,
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined,
        };
      });

      return {
        bio: data.metaDescription || data.text.slice(0, 500),
        followerCount: data.followerCount,
        email: data.email,
        phone: data.phone,
        rawText: data.text.slice(0, 8000),
        recentPosts: [],
        images: [],
        profileUrl: url,
      };
    } catch (err) {
      return { rawText: "", recentPosts: [], images: [], profileUrl: url };
    } finally {
      await page.close();
    }
  }

  private async scrapeTikTok(url: string): Promise<SocialScrapeResult> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3000);

      const data = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers)/);

        return {
          text,
          metaDescription,
          followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined,
        };
      });

      return {
        bio: data.metaDescription || data.text.slice(0, 500),
        followerCount: data.followerCount,
        rawText: data.text.slice(0, 8000),
        recentPosts: [],
        images: [],
        profileUrl: url,
      };
    } catch (err) {
      return { rawText: "", recentPosts: [], images: [], profileUrl: url };
    } finally {
      await page.close();
    }
  }

  async close() {
    await this.browser.close();
  }
}

function parseCount(s: string): number {
  const clean = s.replace(/,/g, "");
  if (clean.toLowerCase().endsWith("k")) return Math.round(parseFloat(clean.slice(0, -1)) * 1000);
  if (clean.toLowerCase().endsWith("m")) return Math.round(parseFloat(clean.slice(0, -1)) * 1_000_000);
  return parseInt(clean, 10) || 0;
}
