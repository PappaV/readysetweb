import { BusinessCategory, HeroConfig, Location } from "@demo-site-generator/shared";

export interface ExtractionInput {
  businessName: string;
  category: BusinessCategory;
  socialProfiles: { platform: string; url: string }[];
  rawSocialData: string;
  location?: string;
}

export const CATEGORY_CONTEXT: Record<BusinessCategory, string> = {
  "real-estate-agent": "a real estate agent selling residential homes, building client trust, showcasing listings and neighborhood expertise",
  "real-estate-developer": "a real estate developer building luxury residential or commercial developments, showcasing masterplans, amenities and quality construction",
  "medspa": "a medical aesthetics clinic offering cosmetic treatments like Botox, fillers, laser and skincare, conveying professionalism, luxury and results",
  "boutique-hospitality": "a boutique hotel offering unique, design-led stays with personalized service and curated experiences",
  "guesthouse-lodge": "a guesthouse or mountain lodge offering cozy accommodation, nature experiences and local hospitality",
};

const HERO_ASSET_MAP: Record<BusinessCategory, string> = {
  "real-estate-agent": "modern-house",
  "real-estate-developer": "luxury-development",
  "medspa": "serum-bottle",
  "boutique-hospitality": "boutique-hotel-lobby",
  "guesthouse-lodge": "mountain-lodge",
};

/** All procedural 3D assets the hero engine can render, grouped by category so
 *  the AI picks a primary + optional secondary assets that fit the business. */
export const HERO_CATALOG: Record<BusinessCategory, string[]> = {
  "medspa": ["serum-bottle", "laser-wand", "facial-cleanser", "spa-lotus", "droplet-orb"],
  "real-estate-agent": ["modern-house", "townhouse-row", "keys-home", "neighborhood-scene"],
  "real-estate-developer": ["luxury-development", "skyline-towers", "gated-estate"],
  "boutique-hospitality": ["boutique-hotel-lobby", "hotel-suite", "poolside-villa"],
  "guesthouse-lodge": ["mountain-lodge", "safari-tent", "campfire-cabin"],
};

export function extractionSystemPrompt(): string {
  return `You are a business intelligence engine. You extract accurate, structured business information from raw social media data and public sources. You NEVER invent facts. If a field is unknown, you omit it or leave it null. You format everything as JSON that matches the provided schema exactly.

Rules:
- Only extract facts that appear in the input data
- Normalize phone numbers to E.164 format when possible
- Classify the business category strictly
- Choose a strong tagline and description using the business's own tone
- Detect brand colors from profile/logo description if present, else use category defaults
- Ratings and review counts must come from data, never guessed
- Choose the heroConfig (3D hero scene) to best match the business's actual services, vibe and brand. Prefer variety: two similar businesses should get different camera paths, lighting and assets whenever their services differ.`;
}

export function extractionUserPrompt(input: ExtractionInput): string {
  return `Extract structured business data for "${input.businessName}" (category: ${input.category}).

CATEGORY CONTEXT: ${CATEGORY_CONTEXT[input.category]}

SOCIAL PROFILES FOUND:
${input.socialProfiles.map((p) => `- ${p.platform}: ${p.url}`).join("\n") || "none found"}

LOCATION: ${input.location ?? "unknown"}

RAW SOURCE DATA (scraped from social profiles, directories, listings):
"""
${input.rawSocialData.slice(0, 12000)}
"""

Return a JSON object with this exact shape:
{
  "name": string,
  "logoName": string (short primary brand name for a logo wordmark — usually the first 2-3 words, e.g. "Micro Derma Clinic"),
  "logoSub": string (a short descriptor line for under the brand name, e.g. "The Aesthetics & Skin"),
  "tagline": string (max 10 words, punchy),
  "description": string (3-4 sentences, warm and professional),
  "phone": string | null,
  "email": string | null,
  "website": string | null,
  "location": { "address": string, "city": string, "state": string, "zipCode": string, "country": string, "neighborhood": string | null } | null,
  "hours": { "monday": string | null, "tuesday": string | null, ... } | null,
  "reviews": [{ "author": string, "rating": number, "text": string, "platform": string }],
  "services": [{ "name": string, "description": string, "price": string | null, "duration": string | null, "category": string | null }],
  "team": [{ "name": string, "role": string }],
  "faqs": [{ "question": string, "answer": string }],
  "brandColors": { "primary": hex, "secondary": hex, "accent": hex },
  "galleryCaptions": string[],
  "heroConfig": {
    "primary3DAsset": one of ${HERO_CATALOG[input.category].join(" | ")},
    "secondaryAssets": string[] (0-2 from the same catalog, different from primary),
    "cameraPath": "drone-descend" | "orbital" | "dolly-zoom" | "fly-through" | "static",
    "scrollBehavior": "parallax" | "pin" | "scrub" | "timeline",
    "lighting": "golden-hour" | "studio" | "moody" | "bright-airy" | "dramatic",
    "colorScheme": "brand" | "warm" | "cool" | "neutral" | "monochrome",
    "particles": boolean
  }
}`;
}

export function heroConfigFallback(category: BusinessCategory): { primary3DAsset: string; secondaryAssets: string[] } {
  return {
    primary3DAsset: HERO_ASSET_MAP[category],
    secondaryAssets: HERO_CATALOG[category].filter((a) => a !== HERO_ASSET_MAP[category]).slice(0, 2),
  };
}

export function copywritingSystemPrompt(category: BusinessCategory, heroConfig: HeroConfig): string {
  return `You are a world-class conversion copywriter for ${CATEGORY_CONTEXT[category]} websites. You write elegant, premium copy that converts visitors into customers. Your tone is confident, warm and specific. Never use clichés like "welcome to our site" or "we're passionate about".

The site uses a 3D cinematic hero with: ${heroConfig.type} focus, ${heroConfig.cameraPath} camera path, ${heroConfig.scrollBehavior} scroll behavior, ${heroConfig.lighting} lighting.

Write copy in this JSON shape:
{
  "hero": { "headline": string (max 8 words), "subheadline": string (max 20 words), "ctaPrimary": string, "ctaSecondary": string },
  "about": { "headline": string, "body": string (3 paragraphs), "stats": [{ "value": string, "label": string }] },
  "servicesIntro": string (1 sentence),
  "reviewsHeading": string,
  "faqHeading": string,
  "contactHeading": string,
  "seo": { "title": string (under 60 chars), "description": string (under 155 chars), "keywords": string[] }
}`;
}

export function copywritingUserPrompt(business: {
  name: string;
  category: BusinessCategory;
  tagline?: string | null;
  description?: string | null;
  services: string[];
  location?: Location | null;
  reviewsCount?: number;
}): string {
  return `Write all website copy for "${business.name}".

CATEGORY: ${business.category}
TAGLINE: ${business.tagline ?? "n/a"}
DESCRIPTION: ${business.description ?? "n/a"}
LOCATION: ${business.location ? `${business.location.city}, ${business.location.state}` : "n/a"}
SERVICES: ${business.services.join(" | ") || "n/a"}
REVIEW COUNT: ${business.reviewsCount ?? 0}

Rules:
- Headlines must be specific to this business, not generic
- Reference the location naturally (e.g., "serving the Austin community")
- Highlight the 3 strongest services
- SEO title/description must include the business name + primary service + location
- Keep everything under token budget; quality over quantity`;
}

export function sectionContentSystemPrompt(category: BusinessCategory): string {
  return `You generate section content for ${CATEGORY_CONTEXT[category]} websites. Output strict JSON.

Prices MUST always be in South African Rand (ZAR) format like "R 1,499" or "R 450". Never use $ or €.

Shape:
{
  "services": [{ "name": string, "description": string (1-2 sentences), "price": string | null (ZAR), "duration": string | null, "icon": "3d-object" | "sparkle" | "shield" | "clock" | "leaf" | "building" }],
  "team": [{ "name": string, "role": string, "bio": string (1 sentence) }],
  "faqs": [{ "question": string, "answer": string (1-2 sentences) }],
  "gallery": [{ "caption": string, "category": string }],
  "pricing": [{ "name": string, "price": string (ZAR), "period": string, "features": string[], "ctaText": string, "popular": boolean, "estimated": boolean }],
  "booking": { "heading": string, "subheading": string, "ctaText": string, "calendarNote": string }
}

ALWAYS fill the pricing array with 2-3 plans and give every service a realistic price. Use real prices from the provided data where available and set "estimated": false. When no real price exists, create a realistic sample price for this category and set "estimated": true (these are placeholders until the business confirms real rates).`;
}

export function sectionContentUserPrompt(business: {
  name: string;
  category: BusinessCategory;
  tagline?: string | null;
  services?: string[];
  team?: string[];
  pricing?: string[];
}): string {
  return `Generate section content for "${business.name}".

CATEGORY: ${business.category}
TAGLINE: ${business.tagline ?? "n/a"}
KNOWN SERVICES: ${business.services?.join(" | ") || "none"}
KNOWN TEAM: ${business.team?.join(" | ") || "none"}
KNOWN PRICING: ${business.pricing?.join(" | ") || "none"}

Fill gaps with realistic, on-brand content. Never contradict known facts.
Pricing rules:
- Use real prices from KNOWN PRICING / known facts where available (estimated=false).
- If no real prices exist, ALWAYS create realistic sample prices in South African Rand (e.g. "R 1,200") for the services and 2-3 pricing plans, and set "estimated": true.
- The demo site must never have an empty pricing section. Return strict JSON.`;
}

export function blogSystemPrompt(category: BusinessCategory): string {
  return `You are an expert content writer for ${CATEGORY_CONTEXT[category]} websites. You write helpful, engaging blog posts that rank in Google and convert readers.

Write 3 blog posts. Each post must be genuinely useful to someone considering this type of business. Output strict JSON:

{
  "posts": [
    {
      "title": string (under 60 chars, keyword-rich),
      "excerpt": string (1-2 sentences, under 160 chars),
      "body": string[] (4-6 paragraphs),
      "tags": string[] (3-5 tags),
      "category": string (post topic category)
    }
  ]
}`;
}

export function blogUserPrompt(business: {
  name: string;
  category: BusinessCategory;
  services: string[];
  city?: string;
}): string {
  return `Write 3 blog posts for "${business.name}", a ${business.category.replace(/-/g, " ")}${business.city ? ` in ${business.city}` : ""}.

SERVICES: ${business.services.join(" | ") || "n/a"}

Post topics should cover real questions customers ask about this type of business — e.g. for a medspa: "What to expect at your first Botox appointment". For each post:
- Title contains the primary keyword
- Body is genuinely helpful, not salesy
- Mentions the business naturally (not in every paragraph)

Return strict JSON matching the schema.`;
}
