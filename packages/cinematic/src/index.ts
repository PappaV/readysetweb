/**
 * Cinematic movie-scene backdrop generator.
 *
 * When a business has no real photos, we CREATIVELY produce unique, cinematic
 * scene backdrops — like film stills — instead of generic stock or 3D objects.
 * Each business gets a deterministic scene derived from its name, category and
 * brand colors: atmosphere (golden hour / blue hour / night / aurora), category
 * silhouette, branded light glow, stars and grain.
 *
 * The SVGs are rasterized to 1080p PNG frames (via headless Chromium) and
 * animated by ffmpeg into the hero video, giving every site a bespoke
 * movie-scene hero.
 */

export type CinematicCategory = "medspa" | "real-estate-agent" | "real-estate-developer" | "boutique-hospitality" | "guesthouse-lodge";

export interface CinematicInput {
  businessName: string;
  tagline?: string;
  category: CinematicCategory;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  seed: number;
  /** 16:9 frame size in px (default 1920x1080) */
  width?: number;
  height?: number;
}

/** FNV-1a hash — deterministic seed/values from a string. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic small PRNG so each business always renders the same scene. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_COLORS = {
  primary: "#1c1c1c",
  secondary: "#3d3d3d",
  accent: "#c8a97e",
};

interface Atmosphere {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  light: string;
  sunColor: string;
  night: boolean;
}

function pickAtmosphere(rand: () => number): Atmosphere {
  const i = Math.floor(rand() * 4);
  switch (i) {
    case 0:
      return { name: "golden", skyTop: "#2a1a2e", skyMid: "#b3482f", skyBottom: "#f2b04c", light: "#ffd9a0", sunColor: "#ffb56b", night: false };
    case 1:
      return { name: "blue", skyTop: "#0a1128", skyMid: "#1b3a5f", skyBottom: "#5b7f9e", light: "#9db8d0", sunColor: "#dfe8f2", night: true };
    case 2:
      return { name: "night", skyTop: "#05060f", skyMid: "#0e1630", skyBottom: "#24355c", light: "#6c7fa8", sunColor: "#dbe4f5", night: true };
    default:
      return { name: "aurora", skyTop: "#04070f", skyMid: "#0a2a2e", skyBottom: "#14564a", light: "#7fe8c8", sunColor: "#bdf5e0", night: true };
  }
}

/** Blended vertical gradient stops. */
function gradient(id: string, top: string, mid: string, bottom: string): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${top}"/>` +
    `<stop offset="0.55" stop-color="${mid}"/>` +
    `<stop offset="1" stop-color="${bottom}"/>` +
    `</linearGradient>`
  );
}

/** Deterministic star field. */
function stars(rand: () => number, count: number, night: boolean): string {
  if (!night) return "";
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = (rand() * 100).toFixed(1);
    const y = (rand() * 55).toFixed(1);
    const r = (0.5 + rand() * 1.4).toFixed(1);
    const o = (0.25 + rand() * 0.6).toFixed(2);
    out += `<circle cx="${x}%" cy="${y}%" r="${r}" fill="#fff" opacity="${o}"/>`;
  }
  return out;
}

/** Soft radial brand glow on the horizon. */
function glow(rand: () => number, accent: string, x: number, y: number, r: number): string {
  const id = `glow${Math.floor(rand() * 1e6)}`;
  return (
    `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${accent}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<ellipse cx="${x}%" cy="${y}%" rx="${r}%" ry="${r * 0.6}%" fill="url(#${id})"/>`
  );
}

/** Category silhouette layered over the sky — the "scene" of the movie. */
function silhouette(category: CinematicCategory, rand: () => number, accent: string, horizonY: number): string {
  const base = `<g fill="#0b0d12">`;
  switch (category) {
    case "guesthouse-lodge": {
      // mountain ridge + pines + cabin with warm lit windows
      let peaks = "";
      for (let i = 0; i < 6; i++) {
        const w = 26 + rand() * 10;
        const h = 26 + rand() * 30;
        const x = i * 17 - 6;
        peaks += `<polygon points="${x},${horizonY} ${x + w / 2},${horizonY - h} ${x + w},${horizonY}" fill="#0c0e14"/>`;
      }
      let pines = "";
      for (let i = 0; i < 12; i++) {
        const x = rand() * 100;
        const h = 7 + rand() * 12;
        pines += `<polygon points="${x},${horizonY} ${x + 2.2},${horizonY - h * 0.6} ${x},${horizonY - h} ${x - 2.2},${horizonY - h * 0.6}" fill="#07090e"/>`;
      }
      const cabinW = 26;
      const cabinH = 14;
      const cabinX = 50 - cabinW / 2;
      const cabinY = horizonY - cabinH;
      const cabin =
        `<rect x="${cabinX}" y="${cabinY}" width="${cabinW}" height="${cabinH}" fill="#0d0f16" rx="1.5"/>` +
        `<polygon points="${cabinX - 3},${cabinY} ${cabinX + cabinW / 2},${cabinY - 9} ${cabinX + cabinW + 3},${cabinY}" fill="#0d0f16"/>` +
        `<rect x="${cabinX + 5}" y="${cabinY + cabinH * 0.5}" width="4.4" height="4.4" fill="${accent}" opacity="0.9"/>` +
        `<rect x="${cabinX + 15}" y="${cabinY + cabinH * 0.5}" width="4.4" height="4.4" fill="${accent}" opacity="0.7"/>`;
      return base + peaks + pines + cabin + `</g>`;
    }
    case "medspa": {
      // spa silhouette: soft rounded forms, eucalyptus stems, warm glow pool
      let plants = "";
      for (let i = 0; i < 8; i++) {
        const x = 4 + i * 13 + rand() * 3;
        const h = 10 + rand() * 14;
        const w = 6 + rand() * 5;
        plants += `<path d="M${x},${horizonY} C${x - w * 0.6},${horizonY - h * 0.7} ${x + w * 0.6},${horizonY - h * 0.4} ${x},${horizonY - h} C${x - w * 0.5},${horizonY - h * 0.55} ${x + w * 0.7},${horizonY - h * 0.5} ${x + 2},${horizonY}" fill="#0a0c12"/>`;
      }
      const poolY = horizonY - 6;
      const pool = `<ellipse cx="50" cy="${poolY}" rx="34" ry="7" fill="#0c0f16" opacity="0.9"/><ellipse cx="50" cy="${poolY - 1}" rx="26" ry="4" fill="${accent}" opacity="0.35"/>`;
      return base + plants + pool + `</g>`;
    }
    case "real-estate-agent":
    case "real-estate-developer": {
      // skyline towers
      let towers = "";
      for (let i = 0; i < 14; i++) {
        const w = 3.5 + rand() * 6;
        const h = 14 + rand() * 34;
        const x = i * 7.4 - 3;
        const lit = rand() > 0.5;
        towers += `<rect x="${x}" y="${horizonY - h}" width="${w}" height="${h}" fill="#0c0e15" rx="0.4"/>`;
        if (lit) {
          const win = Math.floor(rand() * 3) + 2;
          for (let j = 0; j < win; j++) {
            const wy = horizonY - h + 2 + j * 5;
            const wx = x + 1 + (j % 2);
            towers += `<rect x="${wx}" y="${wy}" width="1.3" height="1.6" fill="${accent}" opacity="0.75"/>`;
          }
        }
      }
      return base + towers + `</g>`;
    }
    case "boutique-hospitality": {
      // elegant balustrade + arch columns, warm interior glow
      const arch = (x: number, y: number, w: number, h: number) =>
        `<path d="M${x},${y + h} L${x},${y + h * 0.45} A${w / 2},${h * 0.55} 0 0 1 ${x + w},${y + h * 0.45} L${x + w},${y + h} Z" fill="#0b0d13"/>`;
      let cols = "";
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 14;
        cols += arch(x, horizonY - 24, 9, 24);
      }
      const glowband = `<rect x="0" y="${horizonY - 30}" width="100%" height="30" fill="${accent}" opacity="0.12"/>`;
      return base + glowband + cols + `</g>`;
    }
    default:
      return base + `<path d="M0,${horizonY} Q25,${horizonY - 10} 50,${horizonY} T100,${horizonY} L100,100 L0,100 Z" fill="#0b0d12"/></g>`;
  }
}

/** Compose a single cinematic scene SVG. */
export function cinematicScene(input: CinematicInput): string {
  const w = input.width ?? 1920;
  const h = input.height ?? 1080;
  const rand = mulberry32(input.seed);
  const colors = {
    primary: input.brandColors?.primary ?? DEFAULT_COLORS.primary,
    secondary: input.brandColors?.secondary ?? DEFAULT_COLORS.secondary,
    accent: input.brandColors?.accent ?? DEFAULT_COLORS.accent,
  };
  const atm = pickAtmosphere(rand);
  const horizonY = 66 + Math.floor(rand() * 12);
  const title = (input.businessName || "New Site").toUpperCase();

  const glyphs = `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ`;
  const frameMark = (w: number, h: number, x: number, y: number) =>
    `<g fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2"><path d="M${x},${y} L${x + 60},${y}"/><path d="M${x},${y} L${x},${y + 60}"/><path d="M${w - x},${y} L${w - x - 60},${y}"/><path d="M${w - x},${y} L${w - x},${y + 60}"/><path d="M${x},${h - y} L${x + 60},${h - y}"/><path d="M${x},${h - y} L${x},${h - y - 60}"/><path d="M${w - x},${h - y} L${w - x - 60},${h - y}"/><path d="M${w - x},${h - y} L${w - x},${h - y - 60}"/></g>`;

  // light leak streak
  const leak = rand() > 0.5
    ? `<path d="M${20 + rand() * 40},0 L${40 + rand() * 40},0 L${10 + rand() * 20},${h} L-10,${h} Z" fill="#ffffff" opacity="${(0.03 + rand() * 0.04).toFixed(3)}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${gradient("sky", atm.skyTop, atm.skyMid, atm.skyBottom)}</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>` +
    glow(rand, colors.accent, 50, horizonY, 46) +
    stars(rand, 60 + Math.floor(rand() * 60), atm.night) +
    `<ellipse cx="${30 + rand() * 40}%" cy="${horizonY - 8}%" rx="${12 + rand() * 10}%" ry="${8 + rand() * 6}%" fill="${atm.sunColor}" opacity="${atm.night ? 0.14 : 0.4}"/>` +
    silhouette(input.category, rand, colors.accent, horizonY) +
    leak +
    // subtle vignette
    `<radialGradient id="vig" cx="0.5" cy="0.42" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.42"/></radialGradient>` +
    `<rect width="${w}" height="${h}" fill="url(#vig)"/>` +
    // film letterbox bars (top/bottom)
    `<rect x="0" y="0" width="${w}" height="52" fill="#000"/><rect x="0" y="${h - 52}" width="${w}" height="52" fill="#000"/>` +
    // corner frame marks
    frameMark(w, h, 90, 96) +
    // movie title card
    `<text x="50%" y="${h * 0.5}" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="${Math.min(96, w * 0.048)}" fill="#ffffff" letter-spacing="0.02em" opacity="0.96">${title}</text>` +
    `<text x="50%" y="${h * 0.5 + 70}" text-anchor="middle" font-family="'Inter',sans-serif" font-size="30" fill="#ffffff" fill-opacity="0.6" letter-spacing="0.42em" text-transform="uppercase">${(input.tagline || input.category.replace(/-/g, " ")).toUpperCase().slice(0, 40)}</text>` +
    `<text x="50%" y="${h * 0.5 + 128}" text-anchor="middle" font-family="'Inter',monospace" font-size="18" fill="${colors.accent}" letter-spacing="0.3em">● ● ●</text>` +
    `</svg>`
  );
}

/** Deterministic seed from business identity. */
export function cinematicSeed(businessName: string, category: string): number {
  return hashString(`${businessName}|${category}|cinematic`);
}

export { renderCinematicFrames } from "./frames";
