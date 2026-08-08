import {
  BusinessCategory,
  BusinessData,
  BusinessDataSchema,
  BlogPost,
  BlogPostSchema,
  CATEGORY_DEFAULTS,
  HeroConfig,
  HeroConfigSchema,
  SectionConfigSchema,
} from "@demo-site-generator/shared";
import { DeepSeekClient, DeepSeekConfig, DeepSeekMessage } from "./client";
import {
  blogSystemPrompt,
  blogUserPrompt,
  copywritingSystemPrompt,
  copywritingUserPrompt,
  extractionSystemPrompt,
  extractionUserPrompt,
  HERO_CATALOG,
  sectionContentSystemPrompt,
  sectionContentUserPrompt,
} from "./prompts";

export interface ContentAIInput {
  businessName: string;
  category: BusinessCategory;
  socialProfiles: { platform: string; url: string }[];
  rawSocialData: string;
  location?: string;
  /** Real logo URL scraped from the business's web presence */
  logoUrl?: string;
  /** Real photo URLs scraped for this business (Google Places + website) */
  gallery?: string[];
}

export interface GeneratedContent {
  business: BusinessData;
  sections: typeof SectionConfigSchema._output[];
}

export class ContentGenerator {
  private readonly client: DeepSeekClient;

  constructor(config: DeepSeekConfig) {
    this.client = new DeepSeekClient(config);
  }

  get clientInstance() {
    return this.client;
  }

  /**
   * Answer a website visitor's question using the business's own data.
   * Powers the on-site AI chatbot.
   */
  async chatAnswer(input: {
    business: BusinessData;
    question: string;
    history?: { role: "visitor" | "bot"; text: string }[];
  }): Promise<string> {
    const b = input.business;
    const context = [
      `Business: ${b.name}`,
      b.description ? `About: ${b.description}` : "",
      (b.services ?? []).length ? `Services: ${b.services.map((s) => `${s.name}${s.price ? ` (${s.price})` : ""}`).join(", ")}` : "",
      (b.faqs ?? []).length ? `FAQ: ${b.faqs.map((f) => `${f.question} — ${f.answer}`).join(" | ")}` : "",
      b.hours ? `Hours: ${Object.entries(b.hours).filter(([, v]) => v).map(([d, v]) => `${d}: ${v}`).join(", ")}` : "",
      b.location?.address ? `Address: ${b.location.address}` : "",
      b.phone ? `Phone: ${b.phone}` : "",
      b.email ? `Email: ${b.email}` : "",
      (b.pricing ?? []).length ? `Pricing: ${b.pricing.map((p) => `${p.name} ${p.price}${p.estimated ? " (estimate)" : ""}`).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const historyBlock = (input.history ?? []).map((h) => `${h.role === "visitor" ? "VISITOR" : "YOU"}: ${h.text}`).join("\n");

    const system: DeepSeekMessage = {
      role: "system",
      content: `You are the friendly, professional front-desk assistant for ${b.name}. You help website visitors instantly using ONLY the business details provided. Rules:
- Answer warmly and briefly (max 3 sentences).
- If the visitor asks something not covered, tell them how to reach the business directly (phone/WhatsApp/email) and stay helpful.
- Mention booking if relevant.
- Never invent prices, services, or facts not in the business details.`,
    };
    const user: DeepSeekMessage = {
      role: "user",
      content: [context, historyBlock ? `Conversation:\n${historyBlock}` : "", `VISITOR: ${input.question}`].filter(Boolean).join("\n\n"),
    };

    const result = await this.client.completeJSON<{ reply?: string }>([system, user]);
    return result.reply ?? "";
  }

  /** Draft a reply to a client question/change request about their demo site,
   * plus optional recommendations. Returns structured JSON the admin can approve.
   */
  async draftReply(input: {
    businessName: string;
    category: BusinessCategory;
    clientQuestion: string;
    history?: { role: "client" | "admin"; text: string }[];
    businessSummary?: string;
  }): Promise<{ reply: string; recommendations: string[] }> {
    const historyBlock = (input.history ?? [])
      .map((h) => `${h.role === "client" ? "CLIENT" : "YOU"}: ${h.text}`)
      .join("\n");

    const system: DeepSeekMessage = {
      role: "system",
      content: `You are a friendly, professional account manager for a demo-website business. A client is asking questions or requesting changes about a demo website built for their ${input.businessName} (${input.category.replace(/-/g, " ")}).

Your job is to draft the reply WE send to the client. Rules:
- Be warm, brief and specific. Never promise things we cannot deliver.
- If the client wants changes, recommend 1-3 concrete, sensible improvements to their website, framed as suggestions ("We'd recommend...", "A popular option is...").
- Encourage them to confirm so we can make the site live once paid.
- Return strict JSON: { "reply": string (max 120 words), "recommendations": string[] }`,
    };

    const user: DeepSeekMessage = {
      role: "user",
      content: `BUSINESS: ${input.businessName} (${input.category.replace(/-/g, " ")})`,
    };
    const parts = [
      user.content,
      input.businessSummary ? `BUSINESS SUMMARY:\n${input.businessSummary}` : "",
      historyBlock ? `CONVERSATION SO FAR:\n${historyBlock}` : "",
      `CLIENT MESSAGE:\n${input.clientQuestion}`,
    ];
    user.content = parts.filter(Boolean).join("\n\n");

    const result = await this.client.completeJSON<{ reply?: string; recommendations?: string[] }>([system, user]);
    return {
      reply: result.reply ?? "",
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
    };
  }

  async generate(input: ContentAIInput): Promise<GeneratedContent> {
    const extraction = await this.extractBusinessData(input);

    const copyResult = await this.completeJSONWithRetry(
      [
        { role: "system", content: copywritingSystemPrompt(input.category, extraction.heroConfig ?? CATEGORY_DEFAULTS[input.category].heroConfig) },
        {
          role: "user",
          content: copywritingUserPrompt({
            name: extraction.name,
            category: extraction.category,
            tagline: extraction.tagline,
            description: extraction.description,
            services: extraction.services.map((s) => s.name),
            location: extraction.location,
            reviewsCount: extraction.reviews.length,
          }),
        },
      ],
      undefined
    );

    const sectionResult = await this.generateSections(extraction);

    const blogResult = await this.generateBlog(extraction);

    const realGallery = (input.gallery ?? []).filter(Boolean).slice(0, 8).map((url, i) => ({
      id: `real-${i}`,
      url,
      alt: `${extraction.name} photo ${i + 1}`,
    }));

    // Detect whether any real prices were found in the source data.
    // If not, the pricing shown is sample/dummy until the client confirms real rates.
    const hasRealPrices = /(R\s?\d{2,}|ZAR|Rands|Rand|\bR\d{2,})/i.test(input.rawSocialData);

    const sectionServices = (sectionResult as { services?: Array<{ name: string; description?: string; price?: string | null; duration?: string | null }> }).services ?? [];
    const sectionPricing = (sectionResult as { pricing?: Array<{ name: string; price: string; period?: string; features?: string[]; ctaText?: string; popular?: boolean; estimated?: boolean }> }).pricing ?? [];
    const sectionFaqs = (sectionResult as { faqs?: Array<{ question: string; answer: string }> }).faqs ?? [];

    const business: BusinessData = {
      ...extraction,
      sections: this.buildSectionConfig(extraction.category, sectionResult),
      blog: blogResult.posts,
      logoUrl: input.logoUrl ?? extraction.logoUrl ?? undefined,
      gallery: realGallery.length ? realGallery : extraction.gallery,
      // Merge AI-generated pricing/services so the demo never has an empty pricing section
      pricing: sectionPricing.length
        ? sectionPricing.map((p) => ({
            ...p,
            features: p.features ?? [],
            ctaText: p.ctaText ?? "Get Started",
            popular: p.popular ?? false,
            estimated: p.estimated ?? !hasRealPrices,
          }))
        : extraction.pricing,
      estimatedPricing: !hasRealPrices && sectionPricing.length > 0,
      services: extraction.services.map((s) => {
        const match = sectionServices.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
        return match ? { ...s, price: s.price ?? match.price ?? null, duration: s.duration ?? match.duration ?? null } : s;
      }),
      faqs: extraction.faqs?.length ? extraction.faqs : sectionFaqs,
    };

    const seo = this.extractSEO(copyResult);

    const full: BusinessData = {
      ...business,
      heroConfig: extraction.heroConfig ?? CATEGORY_DEFAULTS[extraction.category].heroConfig,
    };

    return {
      business: full,
      sections: business.sections,
    };
  }

  private async extractBusinessData(input: ContentAIInput) {
    const system: DeepSeekMessage = { role: "system", content: extractionSystemPrompt() };
    const user: DeepSeekMessage = {
      role: "user",
      content: extractionUserPrompt({
        businessName: input.businessName,
        category: input.category,
        socialProfiles: input.socialProfiles,
        rawSocialData: input.rawSocialData,
        location: input.location,
      }),
    };

    // Parse leniently first (the AI often returns partial/loose JSON), then
    // normalize below. Passing the strict schema here would reject incomplete
    // heroConfig before our defaults merge can fill it in.
    const result = await this.client.completeJSON<Record<string, unknown>>([system, user]);

    const defaults = CATEGORY_DEFAULTS[input.category].heroConfig;
    const catalog = HERO_CATALOG[input.category];
    const rawHero = result.heroConfig as Partial<HeroConfig> | undefined;

    const merged = BusinessDataSchema.parse({
      id: crypto.randomUUID(),
      name: (result.name as string) ?? input.businessName,
      category: (result.category as string) ?? input.category,
      sections: [],
      sourceUrls: input.socialProfiles.map((p) => p.url),
      extractedAt: new Date().toISOString(),
      ...result,
      heroConfig: {
        ...defaults,
        ...rawHero,
        // Coerce the 3D asset to something the hero engine can actually render.
        primary3DAsset: rawHero?.primary3DAsset && catalog.includes(rawHero.primary3DAsset)
          ? rawHero.primary3DAsset
          : defaults.primary3DAsset,
        secondaryAssets: (rawHero?.secondaryAssets ?? defaults.secondaryAssets)
          .filter((a) => catalog.includes(a) && a !== (rawHero?.primary3DAsset ?? defaults.primary3DAsset))
          .slice(0, 2),
      },
    });

    // Derive logo wordmark fields if the AI didn't provide them
    if (!merged.logoName) {
      const words = merged.name.split(/\s+/).filter(Boolean);
      merged.logoName = words.slice(0, 2).join(" ");
    }
    if (!merged.logoSub) {
      const words = merged.name.split(/\s+/).filter(Boolean);
      const rest = words.slice(2).join(" ");
      merged.logoSub = rest || merged.category.replace(/-/g, " ");
    }

    return merged;
  }

  private async generateSections(business: BusinessData) {
    const system: DeepSeekMessage = { role: "system", content: sectionContentSystemPrompt(business.category) };
    const user: DeepSeekMessage = {
      role: "user",
      content: sectionContentUserPrompt({
        name: business.name,
        category: business.category,
        tagline: business.tagline,
        services: business.services.map((s) => s.name),
        team: business.team.map((t) => t.name),
        pricing: business.pricing.map((p) => p.name),
      }),
    };

    return this.client.completeJSON([system, user]);
  }

  private async generateBlog(business: BusinessData): Promise<{ posts: BlogPost[] }> {
    const system: DeepSeekMessage = { role: "system", content: blogSystemPrompt(business.category) };
    const user: DeepSeekMessage = {
      role: "user",
      content: blogUserPrompt({
        name: business.name,
        category: business.category,
        services: business.services.map((s) => s.name),
        city: business.location?.city ?? undefined,
      }),
    };

    const result = await this.client.completeJSON<{ posts?: unknown[] }>([system, user]);
    const today = new Date();
    const posts: BlogPost[] = (result.posts ?? []).map((post, i) => {
      const p = post as Partial<BlogPost>;
      return {
        id: crypto.randomUUID(),
        title: p.title ?? "Untitled post",
        excerpt: p.excerpt ?? "",
        body: p.body ?? [],
        category: p.category ?? business.category,
        publishedAt: new Date(today.getTime() - i * 7 * 86400000).toISOString().slice(0, 10),
        tags: p.tags ?? [],
      };
    });

    return { posts };
  }

  private buildSectionConfig(category: BusinessCategory, sectionResult: Record<string, unknown>) {
    const defaults = CATEGORY_DEFAULTS[category].sections;
    const enriched = defaults.map((section) => {
      const contentMap: Record<string, string> = {
        services: "services",
        team: "team",
        faq: "faqs",
        gallery: "gallery",
        pricing: "pricing",
        booking: "booking",
      };
      const dataKey = contentMap[section.type];
      const data = dataKey ? (sectionResult as Record<string, unknown>)[dataKey] : undefined;
      return data ? { ...section, config: { data } } : section;
    });

    return enriched;
  }

  private extractSEO(copyResult: Record<string, unknown>) {
    const seo = (copyResult as { seo?: { title?: string; description?: string; keywords?: string[] } }).seo;
    return {
      title: seo?.title ?? "",
      description: seo?.description ?? "",
      keywords: seo?.keywords ?? [],
    };
  }

  private async completeJSONWithRetry(messages: DeepSeekMessage[], schema: any, attempts = 3): Promise<any> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.client.completeJSON(messages, schema);
      } catch (err) {
        if (i === attempts - 1) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
}
