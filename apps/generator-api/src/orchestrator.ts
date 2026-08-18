import { BusinessCategory, GenerationJob } from "@demo-site-generator/shared";
import { ContentGenerator } from "@demo-site-generator/content-ai";
import { SocialScraper, BusinessEnricher } from "@demo-site-generator/scraper";
import { PlacesClient } from "@demo-site-generator/places-client";
import { updateJob, getJob } from "./store";

export interface GenerateRequest {
  businessName: string;
  category: BusinessCategory;
  socialUrls?: string[];
  rawSocialData?: string;
  location?: string;
  discoverLocation?: string;
  discoverKeywords?: string[];
  contactEmail?: string;
  /** Real scraped photo URLs used to build the hero + gallery (unique per site). */
  gallery?: string[];
}

export interface GenerationResult {
  job: GenerationJob;
  businessData: unknown;
  costUSD?: number;
  previewUrl?: string;
}

type DeployConfig = { provider: "netlify" | "vercel"; token: string; siteName?: string };

type OutreachConfig = {
  provider: "resend" | "smtp";
  fromEmail: string;
  fromName?: string;
  apiKey?: string;
  smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
  senderName: string;
  senderCompany: string;
};

interface StoredGeneratedData {
  business: unknown;
  contactEmail?: string;
  previewUrl?: string;
  deployedUrl?: string;
  costUSD?: number;
}

const generatedStore = new Map<string, StoredGeneratedData>();

export class GenerationOrchestrator {
  private readonly contentGen: ContentGenerator;
  private readonly placesClient?: PlacesClient;
  private readonly deployConfig?: DeployConfig;
  private readonly outreachConfig?: OutreachConfig;

  constructor(config: {
    apiKey: string;
    provider?: "deepseek" | "gemini" | "ollama";
    model?: string;
    baseUrl?: string;
    placesApiKey?: string;
    deploy?: DeployConfig;
    outreach?: OutreachConfig;
  }) {
    this.contentGen = new ContentGenerator({ apiKey: config.apiKey, provider: config.provider, model: config.model, baseUrl: config.baseUrl });
    if (config.placesApiKey) {
      this.placesClient = new PlacesClient({ apiKey: config.placesApiKey });
    }
    this.deployConfig = config.deploy;
    this.outreachConfig = config.outreach;
  }

  /**
   * Phase 1: discover + generate + build + draft-deploy a PREVIEW.
   * Stops in "awaiting-approval" — nothing is emailed until approve() is called.
   */
  async run(jobId: string, request: GenerateRequest): Promise<GenerationResult> {
    updateJob(jobId, { status: "scraping", progress: 15, currentStep: "Gathering business information…" });

    const rawData = await this.gatherData(request, jobId);

    updateJob(jobId, { status: "generating", progress: 50, currentStep: "Writing content with AI…" });

    const generated = await this.contentGen.generate({
      businessName: request.businessName,
      category: request.category,
      socialProfiles: this.parseSocialProfiles(request.socialUrls ?? []),
      rawSocialData: rawData.rawData || `Business name: ${request.businessName}\nCategory: ${request.category}\nLocation: ${request.location ?? "unknown"}`,
      location: request.location,
      logoUrl: rawData.logoUrl,
      gallery: rawData.gallery ?? request.gallery,
    });

    const cost = this.contentGen.clientInstance.getStats();

    let previewUrl: string | undefined;
    if (this.deployConfig) {
      updateJob(jobId, { status: "generating", progress: 70, currentStep: "Building site…" });
      previewUrl = await this.deploySite(generated.business, true, jobId);
    }

    // Store generated data for the approval step
    const businessWithVideo = this.latestHeroVideoUrl
      ? { ...generated.business, heroVideoUrl: this.latestHeroVideoUrl }
      : generated.business;
    generatedStore.set(jobId, {
      business: businessWithVideo,
      contactEmail: request.contactEmail,
      previewUrl,
      costUSD: cost.totalCostUSD,
    });

    updateJob(jobId, {
      status: "awaiting-approval",
      progress: 90,
      currentStep: "Ready for review — awaiting your approval before sending",
      ...(previewUrl ? { deployedUrl: previewUrl } : {}),
      businessData: businessWithVideo,
    });

    return { job: getJob(jobId)!, businessData: businessWithVideo, costUSD: cost.totalCostUSD, previewUrl };
  }

  /**
   * Phase 2a: user approved. Promote preview to production (if needed) and email the owner.
   */
  async approve(jobId: string): Promise<{ deployedUrl?: string; outreachId?: string }> {
    const stored = generatedStore.get(jobId);
    if (!stored) throw new Error(`No generated data for job ${jobId}`);

    updateJob(jobId, { status: "deploying", progress: 92, currentStep: "Publishing site to production…" });

    let deployedUrl = stored.previewUrl;
    if (this.deployConfig) {
      // Draft previews aren't the production URL — redeploy as production to publish
      if (stored.previewUrl) {
        deployedUrl = await this.deploySite(stored.business, false, jobId);
      }
    }
    stored.deployedUrl = deployedUrl;

    let outreachId: string | undefined;
    if (this.outreachConfig && stored.contactEmail && deployedUrl) {
      updateJob(jobId, { status: "deploying", progress: 96, currentStep: "Sending demo to business owner…" });

      const { OutreachManager } = await import("@demo-site-generator/outreach");
      const providerConfig = this.buildProviderConfig();

      const manager = new OutreachManager(providerConfig);
      const business = stored.business as {
        name: string;
        category: BusinessCategory;
        phone?: string;
        location?: { city?: string };
      };
      outreachId = await manager.sendFirstContact({
        businessName: business.name,
        category: business.category,
        demoUrl: deployedUrl,
        senderName: this.outreachConfig.senderName,
        senderCompany: this.outreachConfig.senderCompany,
        city: business.location?.city,
        phone: business.phone,
        email: stored.contactEmail,
      });
    }

    updateJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "Approved — site live and demo sent to business owner",
      deployedUrl,
      businessData: stored.business,
    });

    return { deployedUrl, outreachId };
  }

  /** Publish a previously-generated business straight to production (used on payment). */
  async publishBusiness(business: { name: string; category: string }, jobId?: string): Promise<string> {
    const { buildSite, DeployClient } = await import("@demo-site-generator/deploy");
    if (!this.deployConfig) throw new Error("Deployment not configured");
    if (jobId) {
      try {
        updateJob(jobId, { status: "deploying", progress: 96, currentStep: "Publishing site to production…" });
      } catch {
        // job not in the in-memory store — fine
      }
    }
    const built = await buildSite(business as Parameters<typeof buildSite>[0]);
    const deployer = new DeployClient(this.deployConfig);
    const result = await deployer.deploy({ files: built.files, draft: false });
    return result.url;
  }

  /** Phase 2b: user rejected. Mark job rejected — nothing is sent. */
  async reject(jobId: string): Promise<void> {    const stored = generatedStore.get(jobId);
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      currentStep: "Rejected — no email sent",
      ...(stored?.business ? { businessData: stored.business } : {}),
    });
  }

  /** Phase 2c: user wants another attempt. Regenerate content and re-send preview. */
  async regenerate(jobId: string): Promise<GenerationResult> {
    const stored = generatedStore.get(jobId);
    if (!stored) throw new Error(`No generated data for job ${jobId}`);

    const business = stored.business as { name: string; category: BusinessCategory };
    const job = getJob(jobId);

    updateJob(jobId, { status: "generating", progress: 50, currentStep: "Regenerating content with AI…" });

    const regenerated = await this.contentGen.generate({
      businessName: business.name,
      category: business.category,
      socialProfiles: [],
      rawSocialData: `Business name: ${business.name}\nCategory: ${business.category}`,
    });

    const cost = this.contentGen.clientInstance.getStats();
    let previewUrl: string | undefined;
    if (this.deployConfig) {
      previewUrl = await this.deploySite(regenerated.business, true, jobId);
    }

    generatedStore.set(jobId, {
      business: regenerated.business,
      contactEmail: stored.contactEmail,
      previewUrl,
      costUSD: cost.totalCostUSD,
    });

    updateJob(jobId, {
      status: "awaiting-approval",
      progress: 90,
      currentStep: "Regenerated — ready for review",
      ...(previewUrl ? { deployedUrl: previewUrl } : {}),
      businessData: regenerated.business,
    });

    return { job: getJob(jobId)!, businessData: regenerated.business, costUSD: cost.totalCostUSD, previewUrl };
  }

  private async gatherData(
    request: GenerateRequest,
    jobId: string
  ): Promise<{ rawData: string; logoUrl?: string; gallery?: string[] }> {
    let rawData = request.rawSocialData ?? "";
    let logoUrl: string | undefined;
    let gallery: string[] | undefined;

    // 1) Social scraping
    if (request.socialUrls?.length) {
      const scraper = new SocialScraper({ headless: true });
      try {
        const parts: string[] = [];
        for (const profile of request.socialUrls.slice(0, 3)) {
          const res = await scraper.scrapeProfile(profile);
          if (res.bio) parts.push(`PROFILE (${profile}):\n${res.bio}\n`);
          if (res.followerCount) parts.push(`Followers: ${res.followerCount}\n`);
          if (res.recentPosts.length) parts.push(`Recent posts:\n${res.recentPosts.map((p) => `- ${p.text}`).join("\n")}\n`);
          if (res.email) parts.push(`Email: ${res.email}\n`);
          if (res.phone) parts.push(`Phone: ${res.phone}\n`);
          if (res.rawText) parts.push(`Raw:\n${res.rawText.slice(0, 4000)}\n`);
        }
        if (parts.length) rawData = (rawData ? rawData + "\n\n" : "") + parts.join("\n");
      } catch (err) {
        updateJob(jobId, { currentStep: `Social scrape partial (${(err as Error).message}). Using provided data.` });
      } finally {
        await scraper.close();
      }
    }

    // 2) Places discovery — find a real business without a website as the lead
    if (request.discoverLocation && this.placesClient) {
      try {
        const found = await this.placesClient.findBusinessesWithoutWebsite({
          textQuery: `${request.category.replace(/-/g, " ")} in ${request.discoverLocation}`,
          maxResults: 10,
        });
        updateJob(jobId, {
          currentStep: `Discovered ${found.length} ${request.category} businesses without websites in ${request.discoverLocation}`,
        });

        if (found.length) {
          const lead = found[0];
          const leadData = [
            `Business name: ${lead.displayName}`,
            lead.formattedAddress ? `Address: ${lead.formattedAddress}` : "",
            lead.phone ? `Phone: ${lead.phone}` : "",
            lead.rating ? `Rating: ${lead.rating} (${lead.userRatingCount ?? 0} reviews)` : "",
            lead.openingHoursText ? `Hours: ${lead.openingHoursText.join(", ")}` : "",
            ...(lead.reviews ?? []).map((r) => `Review: "${r.text ?? ""}" — ${r.author} (${r.rating} stars)`),
          ]
            .filter(Boolean)
            .join("\n");

          // Enrich: scrape the business's website (if any) for a real logo,
          // photos, and page text so pricing/services are real.
          const placePhotos = this.placesClient.photoUrls(lead.photos);
          const enricher = new BusinessEnricher({ headless: true });
          try {
            const enriched = await enricher.enrich({
              name: lead.displayName,
              websiteUrl: lead.websiteUri,
              placePhotos,
              location: lead.formattedAddress,
            });
            logoUrl = enriched.logoUrl;
            gallery = enriched.gallery.length ? enriched.gallery : undefined;
            if (enriched.pageText) {
              rawData = [
                rawData,
                leadData,
                `WEBSITE CONTENT (${enriched.source}):\n${enriched.pageText}`,
              ].filter(Boolean).join("\n\n");
            }
          } finally {
            await enricher.close().catch(() => {});
          }

          if (!rawData && leadData) rawData = leadData;
        }
      } catch {
        // discovery is best-effort
      }
    }

    return { rawData, logoUrl, gallery };
  }

  private async deploySite(business: unknown, draft: boolean, jobId: string): Promise<string> {
    const { buildSite, DeployClient } = await import("@demo-site-generator/deploy");
    const built = await buildSite(business as Parameters<typeof buildSite>[0]);
    const deployer = new DeployClient(this.deployConfig!);
    const result = await deployer.deploy({ files: built.files, draft });
    // Propagate the per-site hero video URL so callers can show/report it.
    const heroVideoUrl = (built.business as { heroVideoUrl?: string })?.heroVideoUrl;
    if (heroVideoUrl) this.lastHeroVideoUrl = heroVideoUrl;
    return result.url;
  }

  /** Latest generated hero video URL (set during deploySite). */
  private lastHeroVideoUrl?: string;

  get latestHeroVideoUrl() {
    return this.lastHeroVideoUrl;
  }

  private parseSocialProfiles(urls: string[]) {
    return urls.map((url) => {
      try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "");
        const platform =
          host.includes("instagram") ? "instagram"
          : host.includes("facebook") ? "facebook"
          : host.includes("tiktok") ? "tiktok"
          : host.includes("linkedin") ? "linkedin"
          : "website";
        return { platform, url };
      } catch {
        return { platform: "website" as const, url };
      }
    });
  }

  private buildProviderConfig() {
    if (!this.outreachConfig) throw new Error("Outreach not configured");
    if (this.outreachConfig.provider === "resend") {
      return {
        provider: "resend" as const,
        config: {
          apiKey: this.outreachConfig.apiKey ?? "",
          fromEmail: this.outreachConfig.fromEmail,
          fromName: this.outreachConfig.fromName,
        },
      };
    }
    return {
      provider: "smtp" as const,
      config: {
        host: this.outreachConfig.smtp?.host ?? "",
        port: this.outreachConfig.smtp?.port ?? 587,
        secure: this.outreachConfig.smtp?.secure ?? false,
        user: this.outreachConfig.smtp?.user ?? "",
        pass: this.outreachConfig.smtp?.pass ?? "",
        fromEmail: this.outreachConfig.fromEmail,
        fromName: this.outreachConfig.fromName,
      },
    };
  }
}
