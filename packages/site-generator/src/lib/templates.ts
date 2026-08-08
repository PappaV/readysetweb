import type { BusinessCategory } from "@demo-site-generator/shared";

/**
 * SiteCraft visual templates — 5 completely different design identities.
 * Every business gets one deterministically (hash of name + category) so the
 * same business always renders the same template, but no two businesses look
 * alike. Within a template, a per-business seed further varies layout so even
 * same-template sites don't match.
 */

export type TemplateId = "aurora" | "editorial" | "noir" | "vivid" | "minimal";
export type HeroLayoutId = "cinematic" | "split-card" | "type-led" | "full-bleed" | "portrait";
export type SectionTone = "light" | "alt" | "tint" | "dark";

export interface SiteTemplate {
  id: TemplateId;
  name: string;
  /** Dark vs light base canvas — sets ink/surface defaults. */
  mood: "dark" | "light";
  fonts: { display: string; body: string };
  hero: HeroLayoutId;
  /** Radii scale — pill vs sharp vs soft. */
  radius: string;
  /** Section tone rhythm drives the page's visual cadence. */
  tones: Partial<Record<string, SectionTone>>;
  /** Decor language applied via CSS classes (see global.css). */
  decor: string[];
  /** Default section order (a distinct permutation per template). */
  sectionOrder: string[];
  /** Base color adjustments layered over the business brand colors. */
  baseColors: {
    surface: { h: number; s: number; l: number };
    ink: { h: number; s: number; l: number };
    text: { h: number; s: number; l: number };
  };
}

export interface TemplateSelection {
  template: SiteTemplate;
  /** Per-business seed → unique layout variations inside the template. */
  seed: number;
  /** Hero layout after per-seed variation (can flip between 2 allowed). */
  hero: HeroLayoutId;
}

/** FNV-1a hash → deterministic 32-bit number. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ALL_TEMPLATES: SiteTemplate[] = [
  {
    id: "aurora",
    name: "Aurora",
    mood: "dark",
    fonts: { display: "Fraunces", body: "Manrope" },
    hero: "cinematic",
    radius: "1.5rem",
    tones: {
      about: "light",
      services: "dark",
      gallery: "dark",
      reviews: "tint",
      pricing: "dark",
      booking: "tint",
      faq: "light",
      blog: "dark",
      contact: "light",
    },
    decor: ["aurora", "grain", "glow-orb"],
    sectionOrder: ["hero", "services", "about", "gallery", "pricing", "reviews", "booking", "faq", "contact", "blog"],
    baseColors: {
      surface: { h: 220, s: 20, l: 97 },
      ink: { h: 220, s: 30, l: 5 },
      text: { h: 220, s: 25, l: 9 },
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    mood: "light",
    fonts: { display: "Cormorant Garamond", body: "Inter" },
    hero: "split-card",
    radius: "0.375rem",
    tones: {
      about: "light",
      services: "alt",
      gallery: "light",
      reviews: "alt",
      pricing: "light",
      booking: "tint",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    decor: ["editorial-rule", "index-number"],
    sectionOrder: ["hero", "about", "gallery", "services", "reviews", "team", "faq", "pricing", "contact", "blog"],
    baseColors: {
      surface: { h: 40, s: 30, l: 97 },
      ink: { h: 40, s: 25, l: 6 },
      text: { h: 40, s: 20, l: 10 },
    },
  },
  {
    id: "noir",
    name: "Noir",
    mood: "dark",
    fonts: { display: "Space Grotesk", body: "Space Grotesk" },
    hero: "type-led",
    radius: "0px",
    tones: {
      about: "dark",
      services: "dark",
      gallery: "dark",
      reviews: "dark",
      pricing: "dark",
      booking: "dark",
      faq: "dark",
      blog: "dark",
      contact: "dark",
    },
    decor: ["mono-label", "scanline", "hairline-grid"],
    sectionOrder: ["hero", "about", "services", "gallery", "team", "reviews", "pricing", "faq", "blog", "contact"],
    baseColors: {
      surface: { h: 0, s: 0, l: 4 },
      ink: { h: 0, s: 0, l: 3 },
      text: { h: 0, s: 0, l: 96 },
    },
  },
  {
    id: "vivid",
    name: "Vivid",
    mood: "light",
    fonts: { display: "Sora", body: "DM Sans" },
    hero: "full-bleed",
    radius: "2rem",
    tones: {
      about: "tint",
      services: "light",
      gallery: "tint",
      reviews: "light",
      pricing: "tint",
      booking: "dark",
      faq: "light",
      blog: "tint",
      contact: "light",
    },
    decor: ["gradient-mesh", "blob", "marquee-strip"],
    sectionOrder: ["hero", "services", "pricing", "gallery", "about", "reviews", "booking", "faq", "blog", "contact"],
    baseColors: {
      surface: { h: 260, s: 40, l: 97 },
      ink: { h: 260, s: 40, l: 5 },
      text: { h: 260, s: 35, l: 10 },
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    mood: "light",
    fonts: { display: "Archivo", body: "Inter" },
    hero: "portrait",
    radius: "0.75rem",
    tones: {
      about: "light",
      services: "light",
      gallery: "alt",
      reviews: "light",
      pricing: "light",
      booking: "light",
      faq: "light",
      blog: "light",
      contact: "alt",
    },
    decor: ["thin-line", "letter-spaced", "breath-space"],
    sectionOrder: ["hero", "about", "services", "reviews", "gallery", "pricing", "faq", "blog", "booking", "contact"],
    baseColors: {
      surface: { h: 210, s: 8, l: 98 },
      ink: { h: 210, s: 15, l: 8 },
      text: { h: 210, s: 12, l: 12 },
    },
  },
];

export const TEMPLATES: Record<TemplateId, SiteTemplate> = Object.fromEntries(
  ALL_TEMPLATES.map((t) => [t.id, t])
) as Record<TemplateId, SiteTemplate>;

export const TEMPLATE_IDS = ALL_TEMPLATES.map((t) => t.id);

/**
 * Deterministically assign a template + seed to a business. Different
 * categories can flip which template a name lands on, so two similar
 * businesses still diverge.
 */
export function selectTemplate(businessName: string, category: BusinessCategory): TemplateSelection {
  const base = hashString(businessName.toLowerCase().trim());
  const catShift = hashString(category);
  const index = (base + catShift) % ALL_TEMPLATES.length;
  const template = ALL_TEMPLATES[index];
  const seed = (base ^ catShift) >>> 0;

  // Within a template, allow the hero to flip between two compatible layouts
  // so same-template businesses don't share an identical opening screen.
  const heroFlippers: Record<HeroLayoutId, HeroLayoutId[]> = {
    cinematic: ["cinematic", "full-bleed"],
    "split-card": ["split-card", "portrait"],
    "type-led": ["type-led"],
    "full-bleed": ["full-bleed", "cinematic"],
    portrait: ["portrait", "split-card"],
  };
  const allowed = heroFlippers[template.hero] ?? [template.hero];
  const hero = seed % 3 === 0 ? (allowed[seed % allowed.length] ?? template.hero) : template.hero;

  return { template, seed, hero };
}

/** Deterministic small int in [min, max] from a seed + salt. */
export function seedInt(seed: number, salt: number, min: number, max: number): number {
  const h = (seed + salt * 2654435761) >>> 0;
  return min + (h % (max - min + 1));
}
