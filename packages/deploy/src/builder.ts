import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { BusinessData, BusinessDataSchema } from "@demo-site-generator/shared";
import { heroVideoFilename } from "./render-hero-video";
import { renderCinematicFrames } from "@demo-site-generator/cinematic";
import { photosForBusiness } from "@demo-site-generator/hero-engine";

export interface BuildResult {
  distDir: string;
  files: Record<string, string | Buffer>;
  business: BusinessData;
}

const SITE_GENERATOR_DIR = join(__dirname, "..", "..", "site-generator");
const DATA_FILE = join(SITE_GENERATOR_DIR, "src", "data", "business.ts");
const DIST_DIR = join(SITE_GENERATOR_DIR, "dist");
const PUBLIC_IMAGES_DIR = join(SITE_GENERATOR_DIR, "public", "images");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg", "ico", "avif"]);

export async function buildSite(business: BusinessData): Promise<BuildResult> {
  const withImages = await cacheImages(business);
  // Movie-trailer hero imagery. Priority:
  //   1. the business's REAL photos (Places / website / social),
  //   2. premium free stock from the same industry (seeded per business),
  //   3. creative cinematic scene backdrops (only when nothing above exists).
  const id = (business.id ?? "site").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const realCount = (withImages.gallery ?? []).filter((g) => g.url.startsWith("/")).length;
  const cinematicDir = join(PUBLIC_IMAGES_DIR, id, "cinematic");
  const stockDir = join(PUBLIC_IMAGES_DIR, id, "stock");
  const stockPool = photosForBusiness(business.category, (business.id ?? business.name).length * 31 + business.name.length, 8);

  let cinematicFrames: string[] = [];
  if (realCount < 2) {
    cinematicFrames = await renderCinematicFrames(business, cinematicDir, 6);
  }

  const stockFrames = await downloadStockFrames(stockPool, stockDir);
  const heroVideo = renderSiteHeroVideo(business, withImages, { cinematicFrames, stockFrames });
  const businessWithVideo = { ...withImages, heroVideoUrl: heroVideo };
  writeBusinessData(businessWithVideo);
  writeSeoFiles(businessWithVideo);
  runBuild();
  const files = collectFiles(DIST_DIR);
  return { distDir: DIST_DIR, files, business: businessWithVideo };
}

/**
 * Render a 15s movie-trailer hero MP4. Source priority:
 *   1. the business's real scraped photos (when ≥2),
 *   2. premium free industry stock photos (seeded subset — unique per business),
 *   3. creative cinematic scene backdrops (when no photo source exists),
 * so every site gets a bespoke, film-like hero.
 * The video lands in public/images/<id>/ so the static build includes it and
 * Hero.astro can play it.
 * Returns the public URL path, or undefined if rendering failed / no source.
 */
function renderSiteHeroVideo(
  business: BusinessData,
  withImages: BusinessData,
  frames: { cinematicFrames?: string[]; stockFrames?: string[] } = {}
): string | undefined {
  const { cinematicFrames = [], stockFrames = [] } = frames;
  const id = (business.id ?? "site").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const dir = join(PUBLIC_IMAGES_DIR, id);

  // Real photos cached locally by cacheImages.
  const realPhotos = (withImages.gallery ?? [])
    .map((g) => (g.url.startsWith("/") ? join(PUBLIC_IMAGES_DIR, id, g.url.split("/").pop() ?? "") : undefined))
    .filter((p): p is string => !!p);

  let sources: string[];
  if (realPhotos.length >= 2) {
    sources = realPhotos.slice(0, 8);
  } else if (stockFrames.length >= 3) {
    sources = stockFrames.slice(0, 8);
  } else if (cinematicFrames.length >= 3) {
    sources = cinematicFrames;
  } else {
    sources = [...realPhotos, ...stockFrames];
  }

  if (sources.length < 2) return undefined;

  const filename = heroVideoFilename(business.name);
  const outPath = join(dir, filename);
  const { renderHeroVideo } = require("./render-hero-video") as typeof import("./render-hero-video");

  const ok = renderHeroVideo({
    images: sources.slice(0, 8),
    outputPath: outPath,
    businessName: business.name,
    brandColors: business.brandColors ?? undefined,
    lighting: business.heroConfig?.lighting,
    colorScheme: business.heroConfig?.colorScheme,
    stills: cinematicFrames.length >= 3,
    duration: 15,
  });

  if (!ok) return undefined;
  return `/images/${id}/${filename}`;
}

/** robots.txt + sitemap.xml using the production domain once set. */
function writeSeoFiles(business: BusinessData) {
  const domain = (process.env.SITE_DOMAIN ?? process.env.PUBLIC_BASE_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const origin = domain ? `https://${domain}` : "";
  const slug = (business.name || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const sitemap = origin
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`
    : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://${slug}.example.com</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`;
  writeFileSync(join(SITE_GENERATOR_DIR, "public", "sitemap.xml"), sitemap, "utf-8");
}

/**
 * Download scraped/hotlinked images (Facebook, Instagram, Places, websites)
 * and bundle them into the static site as local files. Social CDN URLs expire
 * within minutes — bundling makes the photos permanent and reliable.
 */
async function cacheImages(business: BusinessData): Promise<BusinessData> {
  const id = (business.id ?? "site").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const dir = join(PUBLIC_IMAGES_DIR, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const referer = (url: string) =>
    url.includes("fbcdn") || url.includes("facebook") ? "https://www.facebook.com/"
    : url.includes("instagram") || url.includes("cdninstagram") ? "https://www.instagram.com/"
    : undefined;

  async function download(url: string, filename: string): Promise<boolean> {
    if (url.startsWith("/") || url.startsWith("data:")) return true;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, ...(referer(url) ? { Referer: referer(url) } : {}) },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return false;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") ?? "";
      if (buf.length < 2000 || !/image|octet-stream/.test(ct)) return false;
      writeFileSync(join(dir, filename), buf);
      return true;
    } catch {
      return false;
    }
  }

  const gallery = [];
  for (let i = 0; i < (business.gallery ?? []).length; i++) {
    const item = business.gallery[i];
    if (item.url.startsWith("/") || item.url.startsWith("data:")) {
      gallery.push(item);
      continue;
    }
    const ext = item.url.split("?")[0].match(/\.(png|webp|gif|jpe?g|avif)/i)?.[1]?.toLowerCase() ?? "jpg";
    const filename = `img-${i}.${ext}`;
    const ok = await download(item.url, filename);
    gallery.push(ok ? { ...item, url: `/images/${id}/${filename}` } : item);
  }

  let logoUrl = business.logoUrl;
  if (logoUrl && !logoUrl.startsWith("/") && !logoUrl.startsWith("data:")) {
    const ok = await download(logoUrl, "logo.png");
    if (ok) logoUrl = `/images/${id}/logo.png`;
  }

  return { ...business, gallery, logoUrl: logoUrl ?? undefined };
}

/** Download premium free industry stock frames locally so the hero video is
 *  self-contained (no hotlinked CDN URLs that can expire). */
async function downloadStockFrames(urls: string[], dir: string): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const out: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const filename = `stock-${i}.jpg`;
    const dest = join(dir, filename);
    try {
      if (!existsSync(dest) || statSync(dest).size < 5000) {
        const res = await fetch(urls[i], {
          headers: { "User-Agent": UA },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 5000) continue;
        writeFileSync(dest, buf);
      }
      out.push(dest);
    } catch {
      // skip a bad image
    }
  }
  return out;
}

function writeBusinessData(business: BusinessData) {
  const validated = BusinessDataSchema.parse(business);
  const ts = `import type { BusinessData } from "@demo-site-generator/shared";\n\nexport const business: BusinessData = ${JSON.stringify(validated, null, 2)} as BusinessData;\n`;
  writeFileSync(DATA_FILE, ts, "utf-8");
}

function runBuild() {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "";
  execSync("pnpm --filter @demo-site-generator/site-generator build", {
    cwd: join(SITE_GENERATOR_DIR, "..", ".."),
    stdio: "pipe",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      // The generated demo site pulls these at build time to activate the
      // chat widget, purchase flow and lead capture against the backend API.
      PUBLIC_CHAT_ENDPOINT: process.env.PUBLIC_CHAT_ENDPOINT ?? baseUrl,
      PUBLIC_PURCHASE_ENDPOINT: process.env.PUBLIC_PURCHASE_ENDPOINT ?? (baseUrl ? `${baseUrl}/api/payments/checkout` : ""),
      PUBLIC_PURCHASE_AMOUNT: process.env.PUBLIC_PURCHASE_AMOUNT ?? "4999",
      PUBLIC_LEADS_ENDPOINT: process.env.PUBLIC_LEADS_ENDPOINT ?? (baseUrl ? `${baseUrl}/api/leads` : ""),
      PUBLIC_GA4_ID: process.env.PUBLIC_GA4_ID ?? "",
      PUBLIC_HOTJAR_ID: process.env.PUBLIC_HOTJAR_ID ?? "",
    },
  });
}

function collectFiles(dir: string): Record<string, string | Buffer> {
  const out: Record<string, string | Buffer> = {};
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const rel = relative(DIST_DIR, full).replace(/\\/g, "/");
        const ext = entry.split(".").pop()?.toLowerCase() ?? "";
        out[rel] = IMAGE_EXTS.has(ext) ? readFileSync(full) : readFileSync(full, "utf-8");
      }
    }
  };
  walk(dir);
  return out;
}

export function resetBusinessData(sample: BusinessData) {
  writeBusinessData(sample);
}

export function siteGeneratorDir() {
  return SITE_GENERATOR_DIR;
}

export function ensureDistDir() {
  mkdirSync(DIST_DIR, { recursive: true });
  return DIST_DIR;
}
