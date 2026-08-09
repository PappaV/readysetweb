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
      await page.waitForTimeout(2500);

      // Only deep-scroll when we're NOT behind a login wall (the grid loads on
      // the initial DOM for public profiles; scrolling a wall page is wasted work).
      const isWall = await page.evaluate(() => /log in|log in to continue/i.test(document.body?.innerText || "")).catch(() => false);
      if (!isWall) {
        await this.deepScroll(page, 6, 900);
        await page.waitForTimeout(1500);
      }

      const data = await page.evaluate(() => {
        const largestSrcset = (img: HTMLImageElement): string | undefined => {
          const srcset = img.getAttribute("srcset");
          if (srcset) {
            let best: string | undefined;
            let bestW = 0;
            srcset.split(",").forEach((c) => {
              const [u, wStr] = [c.trim().split(" ")[0], c.trim().split(" ")[1]];
              const w = wStr ? parseInt(wStr.replace(/\D/g, ""), 10) || 0 : 0;
              if (u && u.startsWith("http") && w > bestW) { best = u; bestW = w; }
            });
            if (best) return best;
          }
          return img.currentSrc || img.src || undefined;
        };
        const upsize = (url: string): string => {
          if (!/instagram|cdninstagram|scontent/i.test(url)) return url;
          return url.replace(/s\d+x\d+(\/|$)/g, "s1080x1080$1").replace(/_\d+x\d+(?=\/|\.)/g, "_1080x1080");
        };
        const parseCount = (s: string): number => {
          const clean = s.replace(/,/g, "");
          if (clean.toLowerCase().endsWith("k")) return Math.round(parseFloat(clean.slice(0, -1)) * 1000);
          if (clean.toLowerCase().endsWith("m")) return Math.round(parseFloat(clean.slice(0, -1)) * 1_000_000);
          return parseInt(clean, 10) || 0;
        };

        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "";

        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers)/);
        const postMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Posts|posts)/);

        // Post images: IG serves them at sizes in srcset — collect the largest.
        const images = Array.from(document.querySelectorAll("img[srcset], img"))
          .map((img) => largestSrcset(img as HTMLImageElement))
          .filter((src): src is string => !!src && src.startsWith("https://"))
          .filter((src) => /instagram|cdninstagram|fbcdn|scontent/i.test(src))
          .filter((src) => !/profile_|static\./i.test(src) && !/\.svg|data:/i.test(src))
          .map((src) => upsize(src))
          .slice(0, 24);

        // Reels/videos on the profile grid.
        const videos = Array.from(document.querySelectorAll("video source, video"))
          .map((v) => ((v as HTMLVideoElement).src || v.getAttribute("src") || ""))
          .filter((src) => src.startsWith("https://") && /instagram|fbcdn|cdninstagram/i.test(src))
          .slice(0, 6);

        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
        const phoneMatch = text.match(/\+?[\d\s().-]{10,15}/);
        const recentPosts = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
          .map((a) => ({ url: (a as HTMLAnchorElement).href, text: (a.textContent ?? "").trim() }))
          .slice(0, 12);

        return { text, metaDescription, ogDescription, followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined, postCount: postMatch ? parseCount(postMatch[1]) : undefined, images, videos, recentPosts, email: emailMatch ? emailMatch[0] : undefined, phone: phoneMatch ? phoneMatch[0] : undefined };
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
        videos: data.videos,
        profileUrl: url,
      };
    } catch (err) {
      console.error("[social:instagram] scrape failed:", (err as Error).message);
      return { rawText: "", recentPosts: [], images: [], videos: [], profileUrl: url };
    } finally {
      await page.close();
    }
  }

  private async scrapeFacebook(url: string): Promise<SocialScrapeResult> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await this.deepScroll(page, 5, 900);
      await page.waitForTimeout(2500);

      const data = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
        const phoneMatch = text.match(/\+?[\d\s().-]{10,15}/);
        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers|people follow this)/);

        const images = Array.from(document.querySelectorAll("img[srcset], img"))
          .map((img) => largestSrcset((img as HTMLImageElement)))
          .filter((src): src is string => !!src && /fbcdn|scontent|facebook/i.test(src))
          .filter((src) => !/\.svg|data:/i.test(src) && !/profile_|static\./i.test(src))
          .slice(0, 20);

        const videos = Array.from(document.querySelectorAll("video source, video"))
          .map((v) => ((v as HTMLVideoElement).src || v.getAttribute("src") || ""))
          .filter((src) => src.startsWith("https://") && /fbcdn|facebook/i.test(src))
          .slice(0, 6);

        return { text, metaDescription, email: emailMatch ? emailMatch[0] : undefined, phone: phoneMatch ? phoneMatch[0] : undefined, followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined, images, videos };
      });

      return {
        bio: data.metaDescription || data.text.slice(0, 500),
        followerCount: data.followerCount,
        email: data.email,
        phone: data.phone,
        rawText: data.text.slice(0, 8000),
        recentPosts: [],
        images: data.images,
        videos: data.videos,
        profileUrl: url,
      };
    } catch (err) {
      return { rawText: "", recentPosts: [], images: [], videos: [], profileUrl: url };
    } finally {
      await page.close();
    }
  }

  private async scrapeTikTok(url: string): Promise<SocialScrapeResult> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await this.deepScroll(page, 5, 900);
      await page.waitForTimeout(2500);

      const data = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
        const followerMatch = text.match(/([\d.,]+[KkMm]?)\s*(?:Followers|followers)/);

        // TikTok serves videos via <video> and images in the grid.
        const videos = Array.from(document.querySelectorAll("video source, video"))
          .map((v) => ((v as HTMLVideoElement).src || v.getAttribute("src") || ""))
          .filter((src) => src.startsWith("https://") && /tiktok|byteoversea|v[0-9]/.test(src))
          .slice(0, 8);
        const images = Array.from(document.querySelectorAll("img[srcset], img"))
          .map((img) => largestSrcset((img as HTMLImageElement)))
          .filter((src): src is string => !!src && /tiktok|byteoversea|p16|p9/i.test(src))
          .filter((src) => !/\.svg|data:/i.test(src))
          .slice(0, 16);

        return { text, metaDescription, followerCount: followerMatch ? parseCount(followerMatch[1]) : undefined, videos, images };
      });

      return {
        bio: data.metaDescription || data.text.slice(0, 500),
        followerCount: data.followerCount,
        rawText: data.text.slice(0, 8000),
        recentPosts: [],
        images: data.images,
        videos: data.videos,
        profileUrl: url,
      };
    } catch (err) {
      return { rawText: "", recentPosts: [], images: [], videos: [], profileUrl: url };
    } finally {
      await page.close();
    }
  }

  /** Scroll down repeatedly to force lazy-loaded post grids to render.
   *  Fully race-bounded so a login wall or heavy page can never hang the scrape. */
  private async deepScroll(page: import("playwright").Page, times: number, px: number) {
    for (let i = 0; i < times; i++) {
      try {
        await Promise.race([
          page.mouse.wheel(0, px),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
        await Promise.race([
          page.waitForTimeout(500),
          new Promise((r) => setTimeout(r, 1000)),
        ]);
      } catch {
        break;
      }
    }
  }

  async close() {
    await this.browser.close();
  }
}

/** Pick the largest candidate from an image's srcset (best quality for the hero). */
function largestSrcset(img: HTMLImageElement): string | undefined {
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    let best: string | undefined;
    let bestW = 0;
    srcset.split(",").forEach((c) => {
      const [u, wStr] = [c.trim().split(" ")[0], c.trim().split(" ")[1]];
      const w = wStr ? parseInt(wStr.replace(/\D/g, ""), 10) || 0 : 0;
      if (u && u.startsWith("http") && w > bestW) { best = u; bestW = w; }
    });
    if (best) return best;
  }
  const src = img.currentSrc || img.src;
  return src || undefined;
}

/**
 * Instagram CDN URLs encode a size suffix (e.g. .../s150x150/... or a trailing
 * "_150x150"). Rewriting it to s1080x1080 returns a much larger version of the
 * same photo when the account is public, so small grid thumbs become hero-grade.
 */
function upsizeInstagram(url: string): string {
  if (!/instagram|cdninstagram|scontent/i.test(url)) return url;
  const bigger = url.replace(/s\d+x\d+(\/|$)/g, "s1080x1080$1").replace(/_\d+x\d+(?=\/|\.)/g, "_1080x1080");
  // If no size suffix was present, append one where the CDN accepts it.
  if (bigger === url && /\/[a-f0-9_]+\.?[a-z0-9]*$/i.test(url)) {
    return `${url}?size=1080`;
  }
  return bigger;
}

function parseCount(s: string): number {
  const clean = s.replace(/,/g, "");
  if (clean.toLowerCase().endsWith("k")) return Math.round(parseFloat(clean.slice(0, -1)) * 1000);
  if (clean.toLowerCase().endsWith("m")) return Math.round(parseFloat(clean.slice(0, -1)) * 1_000_000);
  return parseInt(clean, 10) || 0;
}
