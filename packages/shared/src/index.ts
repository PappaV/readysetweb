import { z } from "zod";

export const BusinessCategorySchema = z.enum([
  "real-estate-agent",
  "real-estate-developer",
  "medspa",
  "boutique-hospitality",
  "guesthouse-lodge",
]);

export type BusinessCategory = z.infer<typeof BusinessCategorySchema>;

export const MAINTENANCE_TIERS = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 499,
    description: "Keep your site live, secure, and current.",
    features: ["Website hosting & SSL", "Daily backups", "Monthly content update", "Uptime monitoring"],
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 1499,
    description: "Your site works as a growth engine.",
    features: [
      "Everything in Starter",
      "2 blog posts / month (AI-written)",
      "SEO optimization",
      "Monthly lead report to your inbox",
    ],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    priceMonthly: 2999,
    description: "Full-service digital presence.",
    features: [
      "Everything in Growth",
      "Unlimited content updates",
      "New pages on request",
      "Priority same-day support",
    ],
  },
] as const;

export type MaintenanceTier = (typeof MAINTENANCE_TIERS)[number]["id"];

export function tierById(id: string) {
  return MAINTENANCE_TIERS.find((t) => t.id === id);
}

export const ONE_OFF_WEBSITE = {
  id: "one-off",
  name: "One-Off Website",
  price: 4999,
  description: "A complete, live website. No subscription — you own it outright.",
  features: ["Cinematic homepage", "10 sections", "Blog-ready", "Mobile optimized", "SEO foundations", "Hosting set up"],
} as const;

export const WEBSITE_ADDONS = [
  {
    id: "blog-pack",
    name: "Blog Content Pack",
    price: 299,
    recurring: true,
    description: "2 professionally written blog posts every month to grow your SEO.",
  },
  {
    id: "newsletter",
    name: "Newsletter Management",
    price: 199,
    recurring: true,
    description: "Design + send a monthly newsletter to your captured leads.",
  },
  {
    id: "seo-boost",
    name: "SEO Optimization",
    price: 399,
    recurring: true,
    description: "Ongoing on-page SEO, keyword research, and monthly reporting.",
  },
  {
    id: "google-business",
    name: "Google Business Profile",
    price: 299,
    recurring: true,
    description: "Setup and management of your Google Business listing.",
  },
  {
    id: "social-integration",
    name: "Social Media Links & Feed",
    price: 199,
    recurring: true,
    description: "Connect and display your social channels on your website.",
  },
  {
    id: "extra-page",
    name: "Extra Page",
    price: 499,
    recurring: false,
    description: "An additional custom page (services, careers, gallery…).",
  },
  {
    id: "lead-reports",
    name: "Monthly Lead Report",
    price: 149,
    recurring: true,
    description: "A breakdown of every lead your site captured, delivered monthly.",
  },
] as const;

export type WebsiteAddon = (typeof WEBSITE_ADDONS)[number]["id"];

export function addonById(id: string) {
  return WEBSITE_ADDONS.find((a) => a.id === id);
}

export const SocialProfileSchema = z.object({
  platform: z.enum(["instagram", "facebook", "google-maps", "website", "linkedin", "tiktok"]),
  url: z.string().url(),
  handle: z.string().optional(),
  followerCount: z.number().optional(),
  verified: z.boolean().default(false),
});

export const BusinessHoursSchema = z.object({
  monday: z.string().nullish(),
  tuesday: z.string().nullish(),
  wednesday: z.string().nullish(),
  thursday: z.string().nullish(),
  friday: z.string().nullish(),
  saturday: z.string().nullish(),
  sunday: z.string().nullish(),
});

export const LocationSchema = z.object({
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zipCode: z.string().nullish(),
  country: z.string().nullish(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  neighborhood: z.string().nullish(),
});

export const ReviewSchema = z.object({
  id: z.string().optional(),
  author: z.string().nullish(),
  rating: z.number().min(1).max(5),
  text: z.string().nullish(),
  date: z.string().optional(),
  platform: z.preprocess(
    (v) => {
      if (typeof v !== "string") return "google";
      const val = v.toLowerCase();
      return ["google", "facebook", "yelp", "tripadvisor", "instagram"].includes(val) ? val : "google";
    },
    z.enum(["google", "facebook", "yelp", "tripadvisor", "instagram"])
  ),
  avatarUrl: z.string().url().optional(),
});

export const ServiceSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().nullish(),
  price: z.string().nullish(),
  duration: z.string().nullish(),
  category: z.string().nullish(),
  imageUrl: z.string().url().optional(),
});

export const TeamMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  role: z.string().nullish(),
  bio: z.string().nullish(),
  imageUrl: z.string().url().optional(),
  socialLinks: z.record(z.string().url()).optional(),
});

export const FAQItemSchema = z.object({
  id: z.string().optional(),
  question: z.string(),
  answer: z.string(),
  category: z.string().nullish(),
});

export const GalleryImageSchema = z.object({
  id: z.string(),
  url: z.union([z.string().url(), z.string().regex(/^\//, "must be absolute path or URL")]),
  alt: z.string(),
  category: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const PricingPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  price: z.string(),
  period: z.string().optional(),
  features: z.array(z.string()),
  ctaText: z.string(),
  ctaLink: z.string().optional(),
  popular: z.boolean().default(false),
  /** True when this price is a placeholder until the business confirms real rates */
  estimated: z.boolean().optional(),
});

export const HeroConfigSchema = z.object({
  type: z.enum(["environment", "object", "typography", "product-showcase"]),
  primary3DAsset: z.string(),
  secondaryAssets: z.array(z.string()).default([]),
  cameraPath: z.enum(["drone-descend", "orbital", "dolly-zoom", "fly-through", "static"]),
  scrollBehavior: z.enum(["parallax", "pin", "scrub", "timeline"]),
  particles: z.boolean().default(true),
  lighting: z.enum(["golden-hour", "studio", "moody", "bright-airy", "dramatic"]),
  colorScheme: z.enum(["brand", "warm", "cool", "neutral", "monochrome"]),
});

export const SectionConfigSchema = z.object({
  id: z.string(),
  type: z.enum([
    "hero",
    "about",
    "services",
    "gallery",
    "reviews",
    "contact",
    "faq",
    "team",
    "pricing",
    "booking",
    "blog",
  ]),
  enabled: z.boolean().default(true),
  order: z.number(),
  config: z.record(z.unknown()).optional(),
});

export const BlogPostSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  excerpt: z.string(),
  body: z.array(z.string()),
  imageUrl: z.string().url().optional(),
  category: z.string().optional(),
  publishedAt: z.string(),
  tags: z.array(z.string()).default([]),
});

export type BlogPost = z.infer<typeof BlogPostSchema>;

export const BusinessDataSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  category: BusinessCategorySchema,
  tagline: z.string().nullish(),
  description: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
  website: z.string().url().nullish(),
  socialProfiles: z.array(SocialProfileSchema).default([]),
  hours: BusinessHoursSchema.nullish(),
  location: LocationSchema.nullish(),
  reviews: z.array(ReviewSchema).default([]),
  services: z.array(ServiceSchema).default([]),
  team: z.array(TeamMemberSchema).default([]),
  faqs: z.array(FAQItemSchema).default([]),
  gallery: z.array(GalleryImageSchema).default([]),
  pricing: z.array(PricingPlanSchema).default([]),
  /** True when pricing shown is sample/dummy until the business confirms real rates */
  estimatedPricing: z.boolean().optional(),
  blog: z.array(BlogPostSchema).default([]),
  logoUrl: z.union([z.string().url(), z.string().regex(/^\//, "must be absolute path or URL")]).nullish(),
  /** Short primary brand name for the logo wordmark (e.g. "Micro Derma Clinic") */
  logoName: z.string().nullish(),
  /** Subtitle line under the brand name (e.g. "The Aesthetics & Skin") */
  logoSub: z.string().nullish(),
  brandColors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }).nullish(),
  heroConfig: HeroConfigSchema.nullish(),
  /** Public URL of the per-site 15s cinematic hero video (rendered at build). */
  heroVideoUrl: z.string().nullish(),
  sections: z.array(SectionConfigSchema).default([]),
  extractedAt: z.string().datetime().nullish(),
  sourceUrls: z.array(z.string().url()).default([]),
});

export type BusinessData = z.infer<typeof BusinessDataSchema>;
export type SocialProfile = z.infer<typeof SocialProfileSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type FAQItem = z.infer<typeof FAQItemSchema>;
export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export type PricingPlan = z.infer<typeof PricingPlanSchema>;
export type HeroConfig = z.infer<typeof HeroConfigSchema>;
export type SectionConfig = z.infer<typeof SectionConfigSchema>;

export const SiteConfigSchema = z.object({
  businessId: z.string(),
  domain: z.string().optional(),
  subdomain: z.string(),
  theme: z.string(),
  sections: z.array(SectionConfigSchema),
  heroConfig: HeroConfigSchema,
  /** True once the client has paid for the site (enables production publish). */
  paid: z.boolean().optional(),
  globalStyles: z.object({
    fontPrimary: z.string(),
    fontSecondary: z.string(),
    colorPrimary: z.string(),
    colorSecondary: z.string(),
    colorAccent: z.string(),
    borderRadius: z.string(),
    spacingScale: z.number(),
  }),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    ogImage: z.string().url().optional(),
  }),
  analytics: z.object({
    ga4Id: z.string().optional(),
    hotjarId: z.string().optional(),
  }).optional(),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export const GenerationJobSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  status: z.enum(["pending", "scraping", "generating", "awaiting-approval", "deploying", "completed", "failed"]),
  progress: z.number().min(0).max(100),
  currentStep: z.string(),
  error: z.string().optional(),
  siteConfig: SiteConfigSchema.optional(),
  businessData: z.unknown().optional(),
  deployedUrl: z.string().url().optional(),
  adminUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const CATEGORY_DEFAULTS: Record<BusinessCategory, {
  heroConfig: HeroConfig;
  theme: string;
  sections: SectionConfig[];
  brandColors: { primary: string; secondary: string; accent: string };
  fonts: { primary: string; secondary: string };
}> = {
  "real-estate-agent": {
    heroConfig: {
      type: "environment",
      primary3DAsset: "modern-house",
      secondaryAssets: ["neighborhood", "cityscape"],
      cameraPath: "drone-descend",
      scrollBehavior: "parallax",
      particles: true,
      lighting: "golden-hour",
      colorScheme: "warm",
    },
    theme: "real-estate",
    brandColors: { primary: "#1a3c5e", secondary: "#2d6a8a", accent: "#d4a843" },
    fonts: { primary: "Playfair Display", secondary: "Inter" },
    sections: [
      { id: "hero", type: "hero", enabled: true, order: 1 },
      { id: "about", type: "about", enabled: true, order: 2 },
      { id: "services", type: "services", enabled: true, order: 3 },
      { id: "gallery", type: "gallery", enabled: true, order: 4 },
      { id: "team", type: "team", enabled: true, order: 5 },
      { id: "reviews", type: "reviews", enabled: true, order: 6 },
      { id: "faq", type: "faq", enabled: true, order: 7 },
      { id: "contact", type: "contact", enabled: true, order: 8 },{ id: "blog", type: "blog", enabled: true, order: 9 },
    ],
  },
  "real-estate-developer": {
    heroConfig: {
      type: "environment",
      primary3DAsset: "luxury-development",
      secondaryAssets: ["masterplan", "amenities"],
      cameraPath: "fly-through",
      scrollBehavior: "timeline",
      particles: true,
      lighting: "golden-hour",
      colorScheme: "warm",
    },
    theme: "real-estate",
    brandColors: { primary: "#0f2d4a", secondary: "#1e5a7a", accent: "#c9a962" },
    fonts: { primary: "Playfair Display", secondary: "Inter" },
    sections: [
      { id: "hero", type: "hero", enabled: true, order: 1 },
      { id: "about", type: "about", enabled: true, order: 2 },
      { id: "services", type: "services", enabled: true, order: 3 },
      { id: "gallery", type: "gallery", enabled: true, order: 4 },
      { id: "pricing", type: "pricing", enabled: true, order: 5 },
      { id: "team", type: "team", enabled: true, order: 6 },
      { id: "reviews", type: "reviews", enabled: true, order: 7 },
      { id: "faq", type: "faq", enabled: true, order: 8 },
      { id: "contact", type: "contact", enabled: true, order: 9 },{ id: "blog", type: "blog", enabled: true, order: 10 },
    ],
  },
  "medspa": {
    heroConfig: {
      type: "product-showcase",
      primary3DAsset: "serum-bottle",
      secondaryAssets: ["skincare-droplets", "light-particles"],
      cameraPath: "orbital",
      scrollBehavior: "scrub",
      particles: true,
      lighting: "studio",
      colorScheme: "cool",
    },
    theme: "medspa",
    brandColors: { primary: "#f8f0f5", secondary: "#e8d5de", accent: "#c4789e" },
    fonts: { primary: "DM Sans", secondary: "DM Sans" },
    sections: [
      { id: "hero", type: "hero", enabled: true, order: 1 },
      { id: "about", type: "about", enabled: true, order: 2 },
      { id: "services", type: "services", enabled: true, order: 3 },
      { id: "gallery", type: "gallery", enabled: true, order: 4 },
      { id: "team", type: "team", enabled: true, order: 5 },
      { id: "reviews", type: "reviews", enabled: true, order: 6 },
      { id: "pricing", type: "pricing", enabled: true, order: 7 },
      { id: "booking", type: "booking", enabled: true, order: 8 },
      { id: "faq", type: "faq", enabled: true, order: 9 },
      { id: "contact", type: "contact", enabled: true, order: 10 },{ id: "blog", type: "blog", enabled: true, order: 11 },
    ],
  },
  "boutique-hospitality": {
    heroConfig: {
      type: "environment",
      primary3DAsset: "boutique-hotel-lobby",
      secondaryAssets: ["room-suite", "amenities"],
      cameraPath: "dolly-zoom",
      scrollBehavior: "parallax",
      particles: true,
      lighting: "moody",
      colorScheme: "neutral",
    },
    theme: "hospitality",
    brandColors: { primary: "#1c1c1c", secondary: "#3d3d3d", accent: "#c8a97e" },
    fonts: { primary: "Cormorant Garamond", secondary: "Inter" },
    sections: [
      { id: "hero", type: "hero", enabled: true, order: 1 },
      { id: "about", type: "about", enabled: true, order: 2 },
      { id: "gallery", type: "gallery", enabled: true, order: 3 },
      { id: "services", type: "services", enabled: true, order: 4 },
      { id: "team", type: "team", enabled: true, order: 5 },
      { id: "reviews", type: "reviews", enabled: true, order: 6 },
      { id: "pricing", type: "pricing", enabled: true, order: 7 },
      { id: "booking", type: "booking", enabled: true, order: 8 },
      { id: "faq", type: "faq", enabled: true, order: 9 },
      { id: "contact", type: "contact", enabled: true, order: 10 },{ id: "blog", type: "blog", enabled: true, order: 11 },
    ],
  },
  "guesthouse-lodge": {
    heroConfig: {
      type: "environment",
      primary3DAsset: "mountain-lodge",
      secondaryAssets: ["landscape", "interior-cozy"],
      cameraPath: "drone-descend",
      scrollBehavior: "parallax",
      particles: true,
      lighting: "golden-hour",
      colorScheme: "warm",
    },
    theme: "hospitality",
    brandColors: { primary: "#2d3a2e", secondary: "#4a5d4b", accent: "#d4b87a" },
    fonts: { primary: "Merriweather", secondary: "Inter" },
    sections: [
      { id: "hero", type: "hero", enabled: true, order: 1 },
      { id: "about", type: "about", enabled: true, order: 2 },
      { id: "gallery", type: "gallery", enabled: true, order: 3 },
      { id: "services", type: "services", enabled: true, order: 4 },
      { id: "pricing", type: "pricing", enabled: true, order: 5 },
      { id: "reviews", type: "reviews", enabled: true, order: 6 },
      { id: "booking", type: "booking", enabled: true, order: 7 },
      { id: "faq", type: "faq", enabled: true, order: 8 },
      { id: "contact", type: "contact", enabled: true, order: 9 },{ id: "blog", type: "blog", enabled: true, order: 10 },
    ],
  },
};


