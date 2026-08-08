import type { BusinessData } from "@demo-site-generator/shared";
import { CATEGORY_DEFAULTS } from "@demo-site-generator/shared";

export function businessInitials(name: string): string {
  const words = name
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "◆";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = words[0][0] ?? "";
  const second = words[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

export function logoColors(business: BusinessData): { primary: string; accent: string; secondary: string } {
  if (business.brandColors?.primary && business.brandColors?.accent) {
    return {
      primary: business.brandColors.primary,
      accent: business.brandColors.accent,
      secondary: business.brandColors.secondary ?? "#0f172a",
    };
  }
  const defaults = CATEGORY_DEFAULTS[business.category]?.brandColors ?? CATEGORY_DEFAULTS["boutique-hospitality"].brandColors;
  return { primary: defaults.primary, accent: defaults.accent, secondary: defaults.secondary };
}

export function monogramSvg(opts: {
  name: string;
  size?: number;
  primary?: string;
  accent?: string;
  rounded?: boolean;
  textColor?: string;
}): string {
  const size = opts.size ?? 48;
  const colors = opts.primary && opts.accent ? opts : { primary: "#1a3c5e", accent: "#c4789e" };
  const primary = opts.primary ?? colors.primary;
  const accent = opts.accent ?? colors.accent;
  const rounded = opts.rounded ?? true;
  const rx = rounded ? size * 0.26 : 0;
  const initials = businessInitials(opts.name);
  const fontSize = size * (initials.length > 1 ? 0.4 : 0.48);
  const textColor = opts.textColor ?? "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="gl" cx="0.35" cy="0.28" r="0.9">
      <stop offset="0" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#lg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#gl)"/>
  <rect x="0.06" y="0.06" width="${size * 0.88}" height="${size * 0.88}" rx="${rx * 0.86}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.2"/>
  <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="${textColor}">${initials}</text>
</svg>`;
}

export function faviconDataUri(business: BusinessData): string {
  const { primary, accent } = logoColors(business);
  const svg = monogramSvg({ name: business.name, size: 64, primary, accent, rounded: true });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function logoMarkup(business: BusinessData, size = 40): { type: "image" | "svg"; markup: string } {
  if (business.logoUrl) {
    return { type: "image", markup: business.logoUrl };
  }
  const { primary, accent } = logoColors(business);
  return { type: "svg", markup: monogramSvg({ name: business.name, size, primary, accent }) };
}
