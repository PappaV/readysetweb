import type { BusinessCategory } from "@demo-site-generator/shared";

export type HeroVariant = "cinematic" | "split" | "centered";
export type SectionTone = "light" | "alt" | "tint" | "dark";

export interface CategoryLayout {
  hero: HeroVariant;
  /** Per-section background tone to create a distinct page rhythm */
  tones: Partial<Record<string, SectionTone>>;
  /** Which sections to feature prominently / reorder (relative emphasis) */
  feature?: string[];
}

export const LAYOUTS: Record<BusinessCategory, CategoryLayout> = {
  // Product showcase: left content, heavy dark cinematic photo, rose accents
  medspa: {
    hero: "cinematic",
    tones: {
      about: "light",
      services: "alt",
      gallery: "light",
      team: "alt",
      reviews: "light",
      pricing: "tint",
      booking: "dark",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    feature: ["pricing", "booking", "reviews"],
  },
  // Gallery-first editorial: centered content, gallery near top
  "boutique-hospitality": {
    hero: "centered",
    tones: {
      about: "light",
      gallery: "light",
      services: "alt",
      reviews: "tint",
      pricing: "light",
      booking: "dark",
      faq: "alt",
      blog: "light",
      contact: "alt",
    },
    feature: ["gallery", "pricing", "booking"],
  },
  // Nature immersion: split hero, editorial about with image collage
  "guesthouse-lodge": {
    hero: "split",
    tones: {
      about: "light",
      gallery: "alt",
      services: "light",
      pricing: "tint",
      reviews: "light",
      booking: "dark",
      faq: "alt",
      blog: "light",
      contact: "light",
    },
    feature: ["gallery", "about", "booking"],
  },
  // Listings focus: split hero with property card, reviews emphasized
  "real-estate-agent": {
    hero: "split",
    tones: {
      about: "light",
      services: "alt",
      gallery: "light",
      team: "alt",
      reviews: "tint",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    feature: ["gallery", "reviews", "contact"],
  },
  // Masterplan cinematic: full-bleed, stats heavy, developer trust
  "real-estate-developer": {
    hero: "cinematic",
    tones: {
      about: "tint",
      services: "light",
      gallery: "alt",
      pricing: "light",
      team: "alt",
      reviews: "tint",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    feature: ["pricing", "gallery", "team"],
  },
};

export function layoutFor(category: BusinessCategory): CategoryLayout {
  return LAYOUTS[category] ?? LAYOUTS.medspa;
}

/** Extra classes applied to a section wrapper based on its tone */
export function toneClass(tone: SectionTone | undefined): string {
  switch (tone) {
    case "alt":
      return "section-alt";
    case "tint":
      return "section-tint";
    default:
      return "";
  }
}