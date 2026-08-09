/**
 * Per-business movie-trailer title cards.
 *
 * Renders a small set of 1080p title-card PNGs from the CLIENT'S OWN data —
 * their name, tagline, top services and a real review — styled with their brand
 * colors. These become the "scenes" of the hero trailer, so every business has
 * a completely unique film even before footage is added.
 */
import { join } from "node:path";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import type { BusinessData } from "@demo-site-generator/shared";
import { hashString, mulberry32 } from "./seed";

export interface TrailerCardInput {
  business: BusinessData;
  outDir: string;
}

export interface TrailerCards {
  /** Paths to the generated title-card PNGs (1080p). */
  cards: string[];
  /** Plain-text captions used as overlay cut-lines in the video. */
  captions: string[];
}

interface CardDef {
  kind: "name" | "tagline" | "services" | "review";
  title: string;
  subtitle?: string;
}

/** Pick the strongest real review (longest, most specific). */
function bestReview(business: BusinessData): string | undefined {
  const reviews = (business.reviews ?? []).filter((r) => r.text && r.text.length > 40);
  if (!reviews.length) return undefined;
  return reviews.sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0].text ?? undefined;
}

function cardDefs(business: BusinessData, rand: () => number): CardDef[] {
  const name = business.name.toUpperCase();
  const tagline = (business.tagline || "").toUpperCase() || undefined;
  const services = (business.services ?? []).slice(0, 3).map((s) => s.name.toUpperCase());
  const review = bestReview(business);
  const city = business.location?.city?.toUpperCase();

  const cards: CardDef[] = [{ kind: "name", title: name, subtitle: tagline || city }];

  if (services.length >= 2) {
    cards.push({ kind: "services", title: services.join("  ·  "), subtitle: "SIGNATURE EXPERIENCES" });
  }
  if (review) {
    const excerpt = review.length > 120 ? `${review.slice(0, 120)}…` : review;
    cards.push({ kind: "review", title: `"${excerpt.toUpperCase()}"`, subtitle: "REAL GUESTS · REAL WORDS" });
  }
  // Always include a closing name card.
  cards.push({ kind: "name", title: name, subtitle: tagline || city });

  return cards;
}

function brandHSL(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, ss = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    ss = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
      case g: hh = (b - r) / d + 2; break;
      default: hh = (r - g) / d + 4;
    }
    hh /= 6;
  }
  return `${Math.round(hh * 360)} ${Math.round(ss * 100)}% ${Math.round(l * 100)}%`;
}

function cardSvg(card: CardDef, business: BusinessData, seed: number): string {
  const w = 1920, h = 1080;
  const accent = business.brandColors?.accent ?? "#c8a97e";
  const primary = business.brandColors?.primary ?? "#1c1c1c";
  const rand = mulberry32(seed);
  const glowX = 20 + Math.floor(rand() * 60);
  const glowY = 25 + Math.floor(rand() * 35);

  const titleSize = card.title.length > 46 ? 50 : card.title.length > 30 ? 64 : 84;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    // Deep cinematic background: brand-tinted near-black with a subtle diagonal sheen
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${primary}"/>` +
    `<stop offset="0.55" stop-color="#0a0b10"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    // Brand glow orb
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${accent}" stop-opacity="0.42"/>` +
    `<stop offset="1" stop-color="${accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    // Top light sheen (studio film look)
    `<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="0.5" stop-color="#ffffff" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    // Vignette
    `<radialGradient id="vig" cx="0.5" cy="0.45" r="0.8">` +
    `<stop offset="0.55" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.55"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<ellipse cx="${glowX}%" cy="${glowY}%" rx="48%" ry="34%" fill="url(#glow)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#sheen)"/>` +
    // letterbox bars
    `<rect x="0" y="0" width="${w}" height="84" fill="#000"/><rect x="0" y="${h - 84}" width="${w}" height="84" fill="#000"/>` +
    // film grain
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0"/></filter><rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.6"/>` +
    `<rect width="${w}" height="${h}" fill="url(#vig)"/>` +
    // top studio credits line
    `<text x="${w / 2}" y="64" text-anchor="middle" font-family="'Arial Narrow',Arial,sans-serif" font-size="18" fill="#ffffff" fill-opacity="0.4" letter-spacing="10">A SITECRAFT FILM PRESENTATION</text>` +
    // accent rule above title
    `<rect x="${w / 2 - 110}" y="382" width="220" height="3" fill="${accent}" opacity="0.9"/>` +
    // eyebrow
    `<text x="${w / 2}" y="452" text-anchor="middle" font-family="'Arial Narrow',Arial,sans-serif" font-size="27" fill="${accent}" letter-spacing="9" opacity="0.95">${card.subtitle ? card.subtitle.toUpperCase() : "COMING SOON"}</text>` +
    // main title
    `<text x="${w / 2}" y="${560}" text-anchor="middle" font-family="Georgia,'Playfair Display',serif" font-size="${titleSize}" fill="#ffffff" font-weight="600" letter-spacing="3">${escapeXml(card.title)}</text>` +
    // accent rule below title
    `<rect x="${w / 2 - 110}" y="${612}" width="220" height="3" fill="${accent}" opacity="0.9"/>` +
    // tagline
    `<text x="${w / 2}" y="686" text-anchor="middle" font-family="'Arial Narrow',Arial,sans-serif" font-size="30" fill="#ffffff" fill-opacity="0.8" letter-spacing="6" font-style="italic">${escapeXml((business.tagline || "COMING SOON").toUpperCase())}</text>` +
    // bottom divider + reel marker
    `<rect x="${w / 2 - 60}" y="726" width="120" height="1" fill="#ffffff" fill-opacity="0.35"/>` +
    `<text x="${w / 2}" y="${h - 130}" text-anchor="middle" font-family="'Arial Narrow',Arial,sans-serif" font-size="18" fill="${accent}" letter-spacing="8">●   ●   ●</text>` +
    `</svg>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Render the business's title cards to 1080p PNGs. */
export async function renderTrailerCards(input: TrailerCardInput): Promise<TrailerCards> {
  const { business, outDir } = input;
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (f.startsWith("card-") && f.endsWith(".png")) rmSync(join(outDir, f), { force: true });
  }

  const seed = hashString(`${business.name}|${business.category}|trailer`);
  const rand = mulberry32(seed);
  const defs = cardDefs(business, rand);

  const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const cards: string[] = [];
  const captions: string[] = [];
  try {
    for (let i = 0; i < defs.length; i++) {
      const svg = cardSvg(defs[i], business, seed + i * 104729);
      await page.setContent(
        `<html><body style="margin:0;padding:0;background:#000;width:1920px;height:1080px;overflow:hidden">${svg}</body></html>`,
        { waitUntil: "load" }
      );
      await page.waitForTimeout(100);
      const png = await page.screenshot({ type: "png" });
      const file = join(outDir, `card-${String(i).padStart(3, "0")}.png`);
      writeFileSync(file, png);
      cards.push(file);
      captions.push(defs[i].title);
    }
  } finally {
    await browser.close();
  }

  return { cards: cards.filter((f) => statSync(f).size > 20_000), captions };
}
