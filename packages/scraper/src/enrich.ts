import { BrowserManager } from "./browser";
import { ScraperConfig } from "./types";

export interface BusinessEnrichmentInput {
  name: string;
  websiteUrl?: string;
  placePhotos?: string[];
  location?: string;
  /** Social profile URLs supplied by the user — used directly (no search needed) */
  socialUrls?: string[];
}

export interface EnrichmentResult {
  logoUrl?: string;
  gallery: string[];
  pageText?: string;
  contactEmail?: string;
  phone?: string;
  source: string;
}

interface RawPageData {
  url: string;
  title?: string;
  favicons: string[];
  ogImage?: string;
  twitterImage?: string;
  headerImages: string[];
  contentImages: string[];
  mailto?: string;
  tel?: string;
  bodyText?: string;
  priceLinks: string[];
}

const MAX_PAGE_TEXT = 15_000;
const MAX_GALLERY = 10;

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

const STOPWORDS = new Set([
  "and", "the", "for", "with", "group", "south", "africa", "cape", "town", "johannesburg",
  "durban", "clinic", "clinics", "aesthetics", "med", "spa", "skin", "beauty", "wellness",
  "studio", "studios", "center", "centre", "pty", "ltd", "cc", "health", "laser", "care",
  "institute", "company", "co", "zulu", "hospitality", "boutique", "hotel", "guesthouse",
  "lodge", "estate", "properties", "property", "real", "agent", "agency", "photography",
]);

/** Distinctive words in a business name used to verify social profiles match. */
function significantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 5);
}

function absoluteUrl(href: string, base: string): string | null {
  if (!href) return null;
  if (href.startsWith("data:")) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function pickLogo(raw: RawPageData, base: string): string | undefined {
  // 1) apple-touch-icon is a dedicated hi-res logo
  const apple = raw.favicons.find((f) => /apple-touch-icon/.test(f));
  if (apple) return absoluteUrl(apple, base) ?? undefined;

  // 2) favicon with explicit large size
  const fav = raw.favicons.find((f) => /sizes=["']\d{2,}x\d{2,}/.test(f));
  if (fav) return absoluteUrl(fav, base) ?? undefined;

  // 3) header logo image
  for (const img of raw.headerImages) {
    const url = absoluteUrl(img, base);
    if (url && !url.includes("placeholder")) return url;
  }

  // 4) any favicon at all
  if (raw.favicons.length) return absoluteUrl(raw.favicons[0], base) ?? undefined;
  return undefined;
}

function pickGallery(raw: RawPageData, base: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: string) => {
    const abs = absoluteUrl(url, base);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push(abs);
    }
  };
  if (raw.ogImage) push(raw.ogImage);
  if (raw.twitterImage) push(raw.twitterImage);
  for (const img of [...raw.headerImages, ...raw.contentImages]) push(img);
  return out.slice(0, MAX_GALLERY);
}

export class BusinessEnricher {
  private readonly browser: BrowserManager;

  constructor(config: ScraperConfig = {}) {
    this.browser = new BrowserManager(config);
  }

  async enrich(input: BusinessEnrichmentInput): Promise<EnrichmentResult> {
    const gallery = [...(input.placePhotos ?? [])].slice(0, MAX_GALLERY);

    // 1) Website (if the business has one)
    let logoUrl: string | undefined;
    let websiteGallery: string[] = [];
    let pageText: string | undefined;
    let contactEmail: string | undefined;
    let phone: string | undefined;
    let source: string | undefined;

    if (input.websiteUrl) {
      const site = await this.scrapeWebsite(input.websiteUrl);
      if (site) {
        logoUrl = site.logoUrl;
        websiteGallery = site.gallery;
        pageText = site.pageText;
        contactEmail = site.contactEmail;
        phone = site.phone;
        source = site.source;
      }
    }

    // 2) Social channels: find the business's Instagram/Facebook/TikTok and
    // pull their REAL photos. These businesses have no website, but almost all
    // have a social presence with actual imagery. User-supplied socialUrls are
    // trusted directly; discovered ones must verify against the business name.
    const socialImages: string[] = [];
    let socialLogo: string | undefined;
    if (gallery.length + websiteGallery.length < 6 || !logoUrl) {
      try {
        const profiles = input.socialUrls?.length
          ? input.socialUrls.slice(0, 2)
          : (await this.findSocialProfiles(input.name, input.location)).slice(0, 2);
        for (const profile of profiles) {
          const imgs = await this.scrapeProfileImages(profile);
          socialImages.push(...imgs);
          if (!socialLogo) socialLogo = await this.scrapeProfileLogo(profile);
          if (socialImages.length >= 6) break;
        }
      } catch {
        // best effort
      }
    }

    const merged = dedupe([...gallery, ...websiteGallery, ...socialImages]).slice(0, MAX_GALLERY);

    return {
      logoUrl: logoUrl ?? socialLogo,
      gallery: merged,
      pageText,
      contactEmail,
      phone,
      source: source ?? "social-media",
    };
  }

  /** Scrape the business's own website for logo, photos, text and contact. */
  private async scrapeWebsite(websiteUrl: string): Promise<{
    logoUrl?: string;
    gallery: string[];
    pageText?: string;
    contactEmail?: string;
    phone?: string;
    source: string;
  } | undefined> {
    try {
      const page = await this.browser.newPage();
      try {
        const startUrl = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`;
        await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await this.sleep(1500);

        const raw = await page.evaluate((): RawPageData => {
          const doc = document;
          const favicons = Array.from(doc.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]'))
            .map((l) => (l as HTMLLinkElement).href)
            .filter(Boolean);
          const ogImage = (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)?.content;
          const twitterImage = (doc.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null)?.content;

          const headerImages = Array.from(doc.querySelectorAll('header img, nav img, [class*="logo"] img, [class*="brand"] img'))
            .map((i) => (i as HTMLImageElement).src)
            .filter((s) => s && !s.startsWith("data:"));

          const contentImages = Array.from(doc.querySelectorAll("main img, section img, [class*='gallery'] img, article img"))
            .map((i) => (i as HTMLImageElement))
            .filter((img) => {
              const w = img.naturalWidth || parseInt(img.getAttribute("width") ?? "0", 10);
              const h = img.naturalHeight || parseInt(img.getAttribute("height") ?? "0", 10);
              return w >= 300 && h >= 200;
            })
            .map((img) => img.currentSrc || img.src)
            .filter((s) => s && !s.startsWith("data:"));

          const mailto = (doc.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null)?.href;
          const tel = (doc.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null)?.href;

          const bodyText = (doc.body?.innerText ?? "").replace(/\s+/g, " ").trim();

          const priceLinks = Array.from(doc.querySelectorAll("a"))
            .map((a) => ({
              href: (a as HTMLAnchorElement).href,
              text: (a.textContent ?? "").trim().toLowerCase(),
            }))
            .filter((l) => /price|pricing|menu|rates|fees|tariff|packages|services/.test(l.text) && l.href)
            .slice(0, 3)
            .map((l) => l.href);

          return {
            url: location.href,
            title: doc.title,
            favicons,
            ogImage,
            twitterImage,
            headerImages: headerImages.slice(0, 5),
            contentImages: contentImages.slice(0, 12),
            mailto,
            tel,
            bodyText,
            priceLinks,
          };
        });

        // Try to pull text from a pricing page for richer pricing extraction
        let text = raw.bodyText ?? "";
        for (const link of raw.priceLinks) {
          if (text.length >= MAX_PAGE_TEXT) break;
          try {
            const u = new URL(link, raw.url);
            if (u.origin !== new URL(raw.url).origin) continue;
            await page.goto(u.href, { waitUntil: "domcontentloaded", timeout: 15_000 });
            await this.sleep(800);
            const extra = await page.evaluate(() => (document.body?.innerText ?? "").replace(/\s+/g, " ").trim());
            if (extra && !text.includes(extra.slice(0, 200))) {
              text = `${text}\n\n${extra}`;
            }
          } catch {
            // best effort
          }
        }

        // If no email yet, follow a contact page and look for mailto / email text
        let email = raw.mailto ? raw.mailto.replace("mailto:", "").split("?")[0] : undefined;
        if (!email) {
          const contactLink = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll("a"));
            const match = anchors.find((a) => {
              const t = (a.textContent ?? "").toLowerCase();
              return /contact|get in touch|enquiries|email us|reach us/.test(t) || /^\/contact/.test(a.getAttribute("href") ?? "");
            });
            return match ? (match as HTMLAnchorElement).href : undefined;
          });
          if (contactLink) {
            try {
              const u = new URL(contactLink, raw.url);
              if (u.origin === new URL(raw.url).origin) {
                await page.goto(u.href, { waitUntil: "domcontentloaded", timeout: 15_000 });
                await this.sleep(800);
                const found = await page.evaluate(() => {
                  const mailto = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null;
                  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ");
                  const textEmail = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                  return { mailto: mailto?.href, textEmail: textEmail?.[0] };
                });
                email = found.mailto ? found.mailto.replace("mailto:", "").split("?")[0] : found.textEmail;
              }
            } catch {
              // best effort
            }
          }
        }
        text = text.slice(0, MAX_PAGE_TEXT);

        return {
          logoUrl: pickLogo(raw, raw.url),
          gallery: pickGallery(raw, raw.url),
          pageText: text || undefined,
          contactEmail: email,
          phone: raw.tel ? raw.tel.replace("tel:", "").split("?")[0] : undefined,
          source: raw.url,
        };
      } finally {
        await page.close();
      }
    } catch {
      return undefined;
    }
  }

  /** Find the business's own Instagram / Facebook / TikTok profile URLs. */
  private async findSocialProfiles(name: string, location?: string): Promise<string[]> {
    const queries = [
      `"${name}" ${location} instagram OR facebook OR tiktok`,
      `${name} ${location} facebook instagram`,
    ];
    const found: string[] = [];
    const nameTokens = significantTokens(name);

    for (const query of queries) {
      if (found.length >= 3) break;
      try {
        const page = await this.browser.newPage();
        try {
          await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: "domcontentloaded",
            timeout: 20_000,
          });
          await this.sleep(2500);
          const hrefs = await page.evaluate(() =>
            Array.from(document.querySelectorAll("a")).map((a) => (a as HTMLAnchorElement).href)
          );
          const decoded = hrefs.map((h) => {
            try {
              const u = new URL(h);
              if (u.hostname.includes("bing.com") && u.pathname.startsWith("/ck/")) {
                const enc = u.searchParams.get("u") || "";
                const b64 = enc.startsWith("a1") ? enc.slice(2) : enc;
                return Buffer.from(b64, "base64").toString("utf-8");
              }
              return h;
            } catch {
              return h;
            }
          });
          const socials = decoded
            .filter((h) => /instagram\.com\/[a-zA-Z0-9._]+|facebook\.com\/[a-zA-Z0-9._-]+|tiktok\.com\/@[a-zA-Z0-9._]+/.test(h))
            .map((h) => h.split("?")[0])
            .filter((h) => !/\/explore\/|\/search\/|login|signup|reel|\/stories\/|sharer|sharer\.php|\.php\?/.test(h));
          for (const social of socials) {
            // Only keep profiles that look like the SAME business (prevents
            // grabbing an unrelated page that shares a word in the name)
            if (await this.verifyProfile(social, nameTokens)) found.push(social);
            if (found.length >= 3) break;
          }
        } finally {
          await page.close();
        }
      } catch {
        // try next query
      }
      if (found.length === 0) await this.sleep(1500); // brief backoff before retry
    }

    return dedupe(found).slice(0, 3);
  }

  /** Confirm a social profile is the same business by checking its page title. */
  private async verifyProfile(url: string, nameTokens: string[]): Promise<boolean> {
    if (!nameTokens.length) return false;
    try {
      const page = await this.browser.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await this.sleep(2000);
        const title = await page.evaluate(() => {
          const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
          const t = document.title || "";
          return `${og ?? ""} ${t}`.toLowerCase();
        });
        let hits = 0;
        for (const token of nameTokens) {
          if (title.includes(token)) hits++;
        }
        return hits >= 2 || (hits === 1 && nameTokens.some((t) => t.length >= 8 && title.includes(t)));
      } finally {
        await page.close();
      }
    } catch {
      return false;
    }
  }

  /** Pull real image URLs from a social profile page. */
  private async scrapeProfileImages(url: string): Promise<string[]> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await this.sleep(3000);
      const imgs = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll("img").forEach((i) => {
          const el = i as HTMLImageElement;
          const src = el.currentSrc || el.src;
          if (src && src.startsWith("http")) out.push(src);
          const srcset = el.getAttribute("srcset");
          if (srcset) {
            srcset.split(",").forEach((c) => {
              const u = c.trim().split(" ")[0];
              if (u && u.startsWith("http")) out.push(u);
            });
          }
        });
        return out;
      });
      const keep = (u: string) => {
        const host = (() => { try { return new URL(u).hostname; } catch { return ""; } })();
        // Real photos live on IG/FB CDNs; drop icons, avatars, tiny thumbs and junk
        return /instagram|fbcdn|scontent|cdninstagram|tiktok/.test(host)
          && !/profile_|static\./i.test(u)
          && !/\.svg|data:/i.test(u)
          && !/s(160|320|240)x(160|320|240)\b/i.test(u);
      };
      return dedupe(imgs.filter(keep)).slice(0, 12);
    } catch {
      return [];
    } finally {
      await page.close();
    }
  }

  /** Extract the business's profile picture (their logo) from a social page. */
  private async scrapeProfileLogo(url: string): Promise<string | undefined> {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await this.sleep(2500);
      const found = await page.evaluate(() => {
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
        if (og) return og;
        const tw = document.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
        if (tw) return tw;
        // Profile pic is often the first large image on the page
        const imgs = Array.from(document.querySelectorAll("img"))
          .map((i) => ({ src: (i as HTMLImageElement).src, w: (i as HTMLImageElement).naturalWidth }))
          .filter((i) => i.src.startsWith("http") && i.w >= 100);
        imgs.sort((a, b) => b.w - a.w);
        return imgs[0]?.src;
      });
      if (found && /instagram|fbcdn|scontent|cdninstagram/.test(found)) return found;
      return undefined;
    } catch {
      return undefined;
    } finally {
      await page.close();
    }
  }

  async close() {
    await this.browser.close();
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
