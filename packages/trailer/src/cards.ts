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
  const glowY = 30 + Math.floor(rand() * 40);

  const titleSize = card.title.length > 46 ? 52 : card.title.length > 30 ? 68 : 88;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${primary}"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</linearGradient>` +
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${accent}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>` +
    `<ellipse cx="${glowX}%" cy="${glowY}%" rx="45%" ry="32%" fill="url(#glow)"/>` +
    // letterbox bars
    `<rect x="0" y="0" width="${w}" height="80" fill="#000"/><rect x="0" y="${h - 80}" width="${w}" height="80" fill="#000"/>` +
    // accent rule above title
    `<rect x="${w / 2 - 90}" y="400" width="180" height="3" fill="${accent}"/>` +
    // eyebrow
    `<text x="${w / 2}" y="470" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.55" letter-spacing="8">${card.subtitle ? card.subtitle.toUpperCase() : "A FILM BY SITECRAFT"}</text>` +
    // main title
    `<text x="${w / 2}" y="580" text-anchor="middle" font-family="Georgia,'Playfair Display',serif" font-size="${titleSize}" fill="#ffffff" font-weight="600" letter-spacing="2">${escapeXml(card.title)}</text>` +
    // accent rule below
    `<rect x="${w / 2 - 90}" y="630" width="180" height="3" fill="${accent}"/>` +
    // bottom small line
    `<text x="${w / 2}" y="${h - 150}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" fill="${accent}" letter-spacing="6">● ● ●</text>` +
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
