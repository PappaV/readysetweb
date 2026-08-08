import { type BusinessCategory, CATEGORY_DEFAULTS } from "@demo-site-generator/shared";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateCSSVariables(
  category: BusinessCategory,
  brandColors?: { primary?: string; secondary?: string; accent?: string }
): Record<string, string> {
  const config = CATEGORY_DEFAULTS[category];
  // Prefer the business's own AI-detected brand colors so every site carries its
  // client's identity; fall back to the category defaults when not detected.
  const { primary, secondary, accent } = {
    primary: brandColors?.primary ?? config.brandColors.primary,
    secondary: brandColors?.secondary ?? config.brandColors.secondary,
    accent: brandColors?.accent ?? config.brandColors.accent,
  };

  const hexToHSL = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  const primaryHSL = hexToHSL(primary);
  const secondaryHSL = hexToHSL(secondary);
  const accentHSL = hexToHSL(accent);

  const lighten = (hsl: ReturnType<typeof hexToHSL>, amount: number) => ({
    ...hsl,
    l: Math.min(100, hsl.l + amount),
  });

  const darken = (hsl: ReturnType<typeof hexToHSL>, amount: number) => ({
    ...hsl,
    l: Math.max(0, hsl.l - amount),
  });

  const toHSLString = (hsl: ReturnType<typeof hexToHSL>) =>
    `${hsl.h} ${hsl.s}% ${hsl.l}%`;

  return {
    "--color-primary": toHSLString(primaryHSL),
    "--color-primary-light": toHSLString(lighten(primaryHSL, 15)),
    "--color-primary-dark": toHSLString(darken(primaryHSL, 15)),
    "--color-secondary": toHSLString(secondaryHSL),
    "--color-secondary-light": toHSLString(lighten(secondaryHSL, 15)),
    "--color-secondary-dark": toHSLString(darken(secondaryHSL, 15)),
    "--color-accent": toHSLString(accentHSL),
    "--color-accent-light": toHSLString(lighten(accentHSL, 15)),
    "--color-accent-dark": toHSLString(darken(accentHSL, 15)),
    "--color-accent-soft": toHSLString({ h: accentHSL.h, s: Math.min(100, accentHSL.s), l: 95 }),
    "--color-surface": toHSLString({ h: primaryHSL.h, s: 8, l: 97 }),
    "--color-surface-muted": toHSLString({ h: primaryHSL.h, s: 10, l: 94 }),
    "--color-surface-tint": toHSLString({ h: primaryHSL.h, s: 26, l: 96 }),
    "--color-surface-elevated": "0 0% 100%",
    "--color-border": toHSLString({ h: primaryHSL.h, s: 12, l: 86 }),
    "--color-border-strong": toHSLString({ h: primaryHSL.h, s: 14, l: 74 }),
    "--color-ink": toHSLString({ h: primaryHSL.h, s: 22, l: 6 }),
    "--color-ink-soft": toHSLString({ h: primaryHSL.h, s: 16, l: 12 }),
    "--color-text-primary": toHSLString({ h: primaryHSL.h, s: 24, l: 9 }),
    "--color-text-secondary": toHSLString({ h: primaryHSL.h, s: 16, l: 38 }),
    "--color-text-muted": toHSLString({ h: primaryHSL.h, s: 12, l: 56 }),
    "--font-primary": config.fonts.primary.replace(/\s+/g, " ").trim(),
    "--font-secondary": config.fonts.secondary.replace(/\s+/g, " ").trim(),
    "--radius-sm": "0.375rem",
    "--radius-md": "0.625rem",
    "--radius-lg": "0.875rem",
    "--radius-xl": "1.25rem",
    "--radius-2xl": "1.75rem",
    "--radius-3xl": "2.25rem",
    "--shadow-soft": "0 1px 2px rgba(15,23,42,0.04), 0 4px 16px -4px rgba(15,23,42,0.06)",
    "--shadow-card": "0 2px 4px rgba(15,23,42,0.04), 0 12px 32px -8px rgba(15,23,42,0.10)",
    "--shadow-lift": "0 4px 8px rgba(15,23,42,0.05), 0 24px 64px -16px rgba(15,23,42,0.18)",
    "--shadow-glow": `0 0 0 1px hsl(${toHSLString(accentHSL)} / 0.25), 0 8px 40px -8px hsl(${toHSLString(accentHSL)} / 0.45)`,
  };
}

export function injectCSSVariables(variables: Record<string, string>, target: HTMLElement = document.documentElement) {
  Object.entries(variables).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
}

export function getCategoryConfig(category: BusinessCategory) {
  return CATEGORY_DEFAULTS[category];
}

export const categoryThemes = {
  "real-estate-agent": "real-estate",
  "real-estate-developer": "real-estate",
  "medspa": "medspa",
  "boutique-hospitality": "hospitality",
  "guesthouse-lodge": "hospitality",
} as const satisfies Record<BusinessCategory, string>;