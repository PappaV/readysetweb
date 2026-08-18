import type { BusinessCategory } from "@demo-site-generator/shared";
import { selectTemplate, type TemplateSelection, type SectionTone } from "./templates";

export type HeroVariant = "cinematic" | "split" | "centered";

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
      walkthrough: "tint",
      team: "alt",
      reviews: "tint",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    feature: ["gallery", "walkthrough", "reviews", "contact"],
  },
  // Masterplan cinematic: full-bleed, stats heavy, developer trust
  "real-estate-developer": {
    hero: "cinematic",
    tones: {
      about: "tint",
      services: "light",
      gallery: "alt",
      walkthrough: "light",
      pricing: "light",
      team: "alt",
      reviews: "tint",
      faq: "light",
      blog: "alt",
      contact: "light",
    },
    feature: ["pricing", "walkthrough", "gallery", "team"],
  },
};

export function layoutFor(category: BusinessCategory): CategoryLayout {
  return LAYOUTS[category] ?? LAYOUTS.medspa;
}

/**
 * Resolve the full template-driven layout for a business: template identity,
 * per-business seed, tones and section order all flow from the template so no
 * two sites share a visual skeleton.
 */
export function templateLayoutFor(businessName: string, category: BusinessCategory): TemplateSelection & {
  tones: Partial<Record<string, SectionTone>>;
  sectionOrder: string[];
} {
  const sel = selectTemplate(businessName, category);
  // Rotate the template's section order by the per-business seed so even two
  // sites on the same template open with different sections.
  const base = sel.template.sectionOrder;
  const rot = (sel.seed % base.length + base.length) % base.length;
  const sectionOrder = [...base.slice(rot), ...base.slice(0, rot)];
  return {
    ...sel,
    tones: sel.template.tones,
    sectionOrder,
  };
}

/** Extra classes applied to a section wrapper based on its tone */
export function toneClass(tone: SectionTone | undefined): string {
  switch (tone) {
    case "alt":
      return "section-alt";
    case "tint":
      return "section-tint";
    case "dark":
      return "section-dark";
    default:
      return "";
  }
}