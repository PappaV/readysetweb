import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { BusinessData, BusinessDataSchema } from "@demo-site-generator/shared";
import { heroVideoFilename } from "./render-hero-video";
import { renderTrailerCards, renderTrailer, downloadFootage, footageFor } from "@demo-site-generator/trailer";
import { renderBlenderHero, blenderSeed } from "@demo-site-generator/blender-hero";

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
  // Each business gets its OWN movie-trailer hero: a from-scratch 3D scene
  // (photoreal product models built in Blender from the business's brand) opens
  // the film, then title cards (name/services/review) + real photos + footage.
  const id = (business.id ?? "site").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const dir = join(PUBLIC_IMAGES_DIR, id);
  const cardsDir = join(dir, "cards");
  const blenderDir = join(dir, "blender");

  // 1) Title cards from the client's own data.
  const { cards } = await renderTrailerCards({ business, outDir: cardsDir });

  // 2) From-scratch 3D hero frames (no scraped images — pure 3D models).
  const scenes = renderBlenderHero({
    business,
    outDir: blenderDir,
    seed: blenderSeed(business.name, business.category),
    stills: 8,
  }).frames;

  // 3) The client's real photos (already cached locally by cacheImages).
  const realPhotos = (withImages.gallery ?? [])
    .map((g) => (g.url.startsWith("/") ? join(dir, g.url.split("/").pop() ?? "") : undefined))
    .filter((p): p is string => !!p && existsSync(p));

  // 4) Real footage: the client's own social videos when available, else living
  //    industry footage — seeded per business so no two sites match.
  const clientVideos = await downloadFootage(business.videos ?? [], join(dir, "client-video"));
  let footage = clientVideos;
  if (footage.length === 0) {
    const footageUrls = footageFor(business.category, (business.id ?? business.name).length * 31 + business.name.length, 3);
    footage = await downloadFootage(footageUrls, join(dir, "footage"));
  }

  // 5) Cut the trailer.
  const filename = heroVideoFilename(business.name);
  const outPath = join(dir, filename);
  let ok = false;
  if (cards.length >= 2) {
    ok = renderTrailer({
      business,
      cards,
      scenes,
      photos: realPhotos.slice(0, 4),
      footage,
      outputPath: outPath,
      duration: 15,
    });
  }
  const heroVideo = ok ? `/images/${id}/${filename}` : undefined;
  const businessWithVideo = { ...withImages, heroVideoUrl: heroVideo };
  writeBusinessData(businessWithVideo);
  writeSeoFiles(businessWithVideo);

  // Source footage/blender frames are build inputs only — don't ship them (the
  // final hero MP4 already contains the composited content).
  for (const sub of ["footage", "client-video", "blender"]) {
    rmSync(join(dir, sub), { recursive: true, force: true });
  }

  runBuild();
  const files = collectFiles(DIST_DIR);
  return { distDir: DIST_DIR, files, business: businessWithVideo };
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

  // Bundle walkthrough room photos the same way so the guided tour's imagery is
  // permanent (hybrid: real photos become local files, missing ones fall back).
  const roomPhotoFiles: string[] = [];
  if (business.walkthrough?.rooms?.length) {
    for (let i = 0; i < business.walkthrough.rooms.length; i++) {
      const room = business.walkthrough.rooms[i];
      if (!room.photoUrl || room.photoUrl.startsWith("/") || room.photoUrl.startsWith("data:")) continue;
      const ext = room.photoUrl.split("?")[0].match(/\.(png|webp|gif|jpe?g|avif)/i)?.[1]?.toLowerCase() ?? "jpg";
      const filename = `room-${i}.${ext}`;
      const ok = await download(room.photoUrl, filename);
      if (ok) roomPhotoFiles.push(`/images/${id}/${filename}`);
    }
  }

  let logoUrl = business.logoUrl;
  if (logoUrl && !logoUrl.startsWith("/") && !logoUrl.startsWith("data:")) {
    const ok = await download(logoUrl, "logo.png");
    if (ok) logoUrl = `/images/${id}/logo.png`;
  }

  // Rewrite the tour's room photos to their local copies (keep order aligned).
  let walkthrough = business.walkthrough;
  if (roomPhotoFiles.length && walkthrough?.rooms) {
    let used = 0;
    walkthrough = {
      ...walkthrough,
      rooms: walkthrough.rooms.map((room) => {
        if (!room.photoUrl || room.photoUrl.startsWith("/") || room.photoUrl.startsWith("data:")) return room;
        const local = roomPhotoFiles[used++];
        return local ? { ...room, photoUrl: local } : room;
      }),
    };
  }

  return { ...business, gallery, logoUrl: logoUrl ?? undefined, walkthrough };
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
