import { BusinessCategory } from "@demo-site-generator/shared";
import { PlacesClient } from "@demo-site-generator/places-client";
import { ContentGenerator } from "@demo-site-generator/content-ai";
import { DeployClient } from "@demo-site-generator/deploy";
import { TelegramBot } from "@demo-site-generator/telegram";
import { BusinessEnricher } from "@demo-site-generator/scraper";
import { OutreachManager, ProviderConfig, WhatsAppClient, WhatsAppConfig } from "@demo-site-generator/outreach";
import { spawn } from "node:child_process";
import { PersistentStore, LeadRecord } from "./store";

export type AutopilotMode = "review" | "auto";

export interface AutopilotConfig {
  deepseekApiKey: string;
  placesApiKey: string;
  deployToken: string;
  deployProvider?: "netlify" | "vercel";
  telegramBotToken: string;
  telegramAdminChatId: string;
  storeFilePath: string;
  /** How long to sleep between discovery cycles */
  cycleIntervalMs?: number;
  /** Max new leads to process per cycle */
  maxPerCycle?: number;
  /** Max total AI spend before pausing (USD) */
  maxDailyCostUSD?: number;
  /** Categories + locations to scan */
  targets: {
    category: BusinessCategory;
    locations: string[];
    keywords: string[];
    /**
     * Which places to target. "no-website" (default) is the classic pitch — the
     * business has no site at all. "any" targets all qualifying businesses even
     * if they have a website (pitch = upgrade + walkthrough). "with-website"
     * targets only businesses that DO have a site (best for walkthrough upsells).
     */
    websiteFilter?: "no-website" | "any" | "with-website";
  }[];
  /** generator-api base URL — used to register previews so payments can trigger go-live */
  apiUrl?: string;
  /** Max Google Places searchText calls per day (free quota is 100/day) */
  maxDailySearches?: number;
  /** How long to reuse cached Places results (ms) before re-querying */
  discoveryCacheTtlMs?: number;
  /**
   * "review" (default): every site is sent to the admin for approval before the
   * demo goes to the client. "auto": the full sales process runs automatically.
   * Can be toggled live with /mode.
   */
  mode?: AutopilotMode;
  /** Email delivery + follow-up sequence */
  outreach?: { config: ProviderConfig; senderName: string; senderCompany: string };
  /** WhatsApp delivery for businesses with no email */
  whatsapp?: WhatsAppConfig;
  /** Days between first contact and follow-up 1 (default 1) */
  followUpDay1?: number;
  /** Days between follow-up 1 and follow-up 2 (default 3) */
  followUpDay2?: number;
  /** Days between follow-up 2 and the final breakup message (default 7) */
  breakupDay?: number;
  /** Where to save auto-recorded 10-15s hero videos (MP4). If set, each site's
   *  hero is recorded after deploy for use in outreach/WhatsApp. */
  heroVideoDir?: string;
  /** Path to the record-hero script */
  recordHeroScript?: string;
}

export interface AutopilotHandle {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

export class AutopilotEngine {
  private readonly store: PersistentStore;
  private readonly places: PlacesClient;
  private readonly contentGen: ContentGenerator;
  private readonly deployClient: DeployClient;
  private readonly telegram: TelegramBot;
  private readonly config: AutopilotConfig;
  private readonly outreachManager?: OutreachManager;
  private readonly whatsapp?: WhatsAppClient;
  private running = false;
  private startedAt: string | null = null;
  private dailyCostUSD = 0;
  private rotateIndex = 0;

  constructor(config: AutopilotConfig) {
    this.config = config;
    this.store = new PersistentStore(config.storeFilePath);
    this.places = new PlacesClient({ apiKey: config.placesApiKey });
    this.contentGen = new ContentGenerator({ apiKey: config.deepseekApiKey });
    this.deployClient = new DeployClient({
      provider: config.deployProvider ?? "netlify",
      token: config.deployToken,
    });
    this.telegram = new TelegramBot({
      botToken: config.telegramBotToken,
      adminChatId: config.telegramAdminChatId,
    });
    if (config.outreach) {
      this.outreachManager = new OutreachManager(config.outreach.config);
    }
    if (config.whatsapp) {
      this.whatsapp = new WhatsAppClient(config.whatsapp);
    }
  }

  get stats() {
    return this.store.getStats();
  }

  getLeads() {
    return this.store.getAllLeads();
  }

  get mode(): AutopilotMode {
    const stored = this.store.getMeta()?.mode;
    return stored === "auto" || stored === "review" ? stored : (this.config.mode ?? "review");
  }

  setMode(mode: AutopilotMode) {
    this.store.upsertMeta({ mode });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = new Date().toISOString();

    const modeLine =
      this.mode === "auto"
        ? `Running the <b>full sales process automatically</b> — I'll build sites, send demos, follow up, and take payment. You'll only be notified when a client pays or needs help.`
        : `Running in <b>review mode</b> — I'll build each site and send it to you for approval before the demo goes to the client. Once you're happy with the quality, switch to /mode auto.`;

    this.telegram.send({
      text: `🚀 <b>Autopilot started</b>\n\n${modeLine}\n\nCommands: /status · /mode auto|review · /delivered <leadId> · /stop`,
      parseMode: "HTML",
    }).catch(() => {});

    // Poll for approval decisions + commands
    this.telegram.startPolling((update) => this.handleTelegramUpdate(update));

    this.loop();
  }

  private async handleTelegramUpdate(update: {
    callback_query?: {
      id: string;
      data?: string;
      message?: { message_id: number; chat: { id: number } };
    };
    message?: { text?: string; chat?: { id: number } };
  }): Promise<void> {
    // Plain commands
    if (update.message?.text) {
      const text = update.message.text.trim();
      if (text === "/status" || text === "/stats") {
        const s = this.store.getStats();
        await this.telegram.send({
          text:
            `<b>Autopilot status</b>\n\n` +
            `Mode: <b>${this.mode}</b>\n` +
            `Total leads: ${s.totalLeads}\n` +
            `Awaiting review: ${s.awaitingApproval}\n` +
            `Approved: ${s.approved}\n` +
            `Sent (demo delivered): ${s.sent}\n` +
            `Rejected: ${s.rejected}\n` +
            `Failed: ${s.failed}\n` +
            `Jobs: ${s.totalJobs}\n` +
            `Processed companies: ${s.processedCompanies}\n` +
            (this.startedAt ? `Started: ${this.startedAt}` : ""),
          parseMode: "HTML",
        });
        return;
      }
      if (text === "/mode") {
        await this.telegram.send({ text: `Current mode: <b>${this.mode}</b>. Use /mode auto or /mode review.`, parseMode: "HTML" });
        return;
      }
      if (text === "/mode auto") {
        this.setMode("auto");
        await this.telegram.send({ text: "⚡ <b>Auto mode ON.</b> New sites will be sent straight to clients — no preview review.", parseMode: "HTML" });
        return;
      }
      if (text === "/mode review") {
        this.setMode("review");
        await this.telegram.send({ text: "🛡️ <b>Review mode ON.</b> Every site waits for your approval before reaching the client.", parseMode: "HTML" });
        return;
      }
      if (text.startsWith("/delivered")) {
        const leadId = text.split(" ")[1];
        if (leadId && this.store.getLead(leadId)) {
          this.store.updateLead(leadId, { status: "delivered" });
          await this.telegram.send({ text: `✅ Marked ${leadId} as delivered.` });
        } else {
          await this.telegram.send({ text: "Usage: /delivered <leadId>" });
        }
        return;
      }
      if (text === "/stop") {
        this.stop();
        return;
      }
      if (text === "/start") {
        this.start();
        return;
      }
      // Unknown command — forward to the API (support /reply, /conversations, etc.)
      await this.forwardToSupport(update);
      return;
    }

    // Button callbacks
    const cb = update.callback_query;
    if (!cb?.data?.startsWith("approval:")) {
      // Not an autopilot approval (e.g. reply:) — the API handles those
      await this.forwardToSupport(update);
      return;
    }

    const [, jobId, action] = cb.data.split(":");
    const job = this.store.getJob(jobId);
    const leadId = job?.leadId;

    await this.telegram.answerCallback(cb.id, `Processing ${action}…`);

    if (action === "approve") {
      if (leadId) {
        await this.approveAndSend(leadId, job?.businessName ?? jobId, job?.previewUrl);
      }
      this.store.updateJob(jobId, { status: "approved" });
    } else if (action === "reject") {
      if (leadId) this.store.updateLead(leadId, { status: "rejected" });
      this.store.updateJob(jobId, { status: "rejected" });
      await this.telegram.send({ text: `❌ Rejected ${job?.businessName ?? jobId}. No demo sent.` });
    } else if (action === "regenerate") {
      if (leadId) {
        const lead = this.store.getLead(leadId);
        if (lead) {
          this.store.updateLead(leadId, { status: "previewing" });
          await this.telegram.send({
            text: `🔄 Regenerating ${lead.businessName}. I'll send the new preview shortly.`,
          });
          this.processLead({ name: lead.businessName, place: { formattedAddress: lead.location } }, lead.category as BusinessCategory).catch(() => {});
          return;
        }
      }
      this.store.updateJob(jobId, { status: "regenerating" });
      await this.telegram.send({ text: `🔄 Regenerating ${job?.businessName ?? jobId}.` });
    }
  }

  stop(): void {
    this.running = false;
    this.telegram.send({ text: `🛑 Autopilot stopped.` }).catch(() => {});
  }

  isRunning(): boolean {
    return this.running;
  }

  private async loop() {
    while (this.running) {
      const started = Date.now();
      try {
        await this.cycle();
        await this.runFollowUps();
      } catch (err) {
        console.error("[autopilot] cycle error:", (err as Error).message);
        this.telegram.send({ text: `⚠️ Autopilot cycle error: ${(err as Error).message}` }).catch(() => {});
      }

      const elapsed = Date.now() - started;
      const interval = this.config.cycleIntervalMs ?? 3_600_000; // default 1h between cycles
      await this.sleep(Math.max(interval - elapsed, 10_000));
    }
  }

  private async cycle() {
    if (this.dailyCostUSD >= (this.config.maxDailyCostUSD ?? 2)) {
      this.telegram.send({
        text: `⛔ Daily AI budget reached ($${this.dailyCostUSD.toFixed(3)}). Pausing new discoveries until tomorrow.`,
      }).catch(() => {});
      await this.sleep(6 * 3600_000);
      this.dailyCostUSD = 0;
      return;
    }

    const max = this.config.maxPerCycle ?? 3;
    let processed = 0;

    // Retry leads that failed or got stuck mid-generation in a previous cycle.
    // Uses the same per-cycle budget so retries can't starve new discoveries.
    const staleTtl = 10 * 60_000; // don't retry leads updated within the last 10 min
    const retryable = this.store
      .getAllLeads()
      .filter((l) => l.status === "failed" || l.status === "previewing" || l.status === "discovered")
      .filter((l) => Date.now() - new Date(l.updatedAt).getTime() > staleTtl)
      .filter((l) => Number((l as LeadRecord & { retryCount?: number }).retryCount ?? 0) < 3)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

    for (const lead of retryable) {
      if (processed >= max || !this.running) break;
      const retryCount = Number((lead as LeadRecord & { retryCount?: number }).retryCount ?? 0);
      this.store.updateLead(lead.id, { retryCount: retryCount + 1 });
      await this.processLead(
        {
          name: lead.businessName,
          place: {
            displayName: lead.businessName,
            formattedAddress: lead.location,
            phone: lead.phone,
            googleMapsUrl: lead.sourceUrl,
          },
        },
        lead.category as BusinessCategory,
        lead.id
      );
      processed++;
    }

    for (const target of this.config.targets) {
      if (processed >= max || !this.running) break;

      const leads = await this.discoverLeads(target);
      for (const lead of leads) {
        if (processed >= max || !this.running) break;
        await this.processLead(lead, target.category);
        processed++;
      }
    }
  }

  private async discoverLeads(target: { category: BusinessCategory; locations: string[]; keywords: string[]; websiteFilter?: "no-website" | "any" | "with-website" }) {
    const fresh: Array<{ name: string; place: unknown }> = [];
    const max = this.config.maxPerCycle ?? 3;
    const maxSearches = this.config.maxDailySearches ?? 80;
    const cacheTtl = this.config.discoveryCacheTtlMs ?? 12 * 3600_000;
    const today = new Date().toISOString().slice(0, 10);
    const meta = this.store.getMeta();
    const websiteFilter = target.websiteFilter ?? "no-website";

    // Reset the daily search counter when the date rolls over
    let searchesUsed = meta.searchDay === today ? Number(meta.searchesToday ?? 0) : 0;
    if (meta.searchDay !== today) {
      this.store.upsertMeta({ searchDay: today, searchesToday: 0 });
      searchesUsed = 0;
    }

    const locations = [...target.locations];
    for (let k = 0; k < locations.length; k++) {
      if (!this.running) break;
      // Round-robin: pick a different starting location each cycle so one
      // location doesn't hog the daily quota
      const location = locations[(this.rotateIndex + k) % locations.length];
      const cacheKey = `discovery:${target.category}:${location}`;

      let places: any[] | undefined = (meta[cacheKey] as { ts?: number; places?: any[]; failed?: boolean } | undefined)?.places;
      const cached = meta[cacheKey] as { ts?: number; failed?: boolean } | undefined;
      const cachedAt = cached?.ts ?? 0;
      const retryTtl = cached?.failed ? 3600_000 : cacheTtl; // retry failures after 1h
      const freshEnough = places && Date.now() - cachedAt < retryTtl;

      if (!freshEnough) {
        if (searchesUsed >= maxSearches) break; // daily search budget reached
        try {
          if (websiteFilter === "no-website") {
            places = await this.places.findBusinessesWithoutWebsite({
              textQuery: `${target.keywords.join(" ")} in ${location}`,
              maxResults: 10,
            });
          } else {
            places = await this.places.searchBusinesses(
              { textQuery: `${target.keywords.join(" ")} in ${location}`, maxResults: 10 },
              { requireWebsite: websiteFilter === "with-website" }
            );
          }
        } catch (err) {
          console.error(`[autopilot] places search failed for ${location}:`, (err as Error).message);
          this.telegram.send({
            text: `⚠️ Places search failed for "${location}" (${target.category}): ${(err as Error).message}. Check your Google Places API key + quota.`,
          }).catch(() => {});
          // Cache the failure so we don't hammer the API every cycle
          searchesUsed++;
          this.store.upsertMeta({ searchDay: today, searchesToday: searchesUsed, [cacheKey]: { ts: Date.now(), places: [], failed: true } });
          continue;
        }
        searchesUsed++;
        this.store.upsertMeta({ searchDay: today, searchesToday: searchesUsed, [cacheKey]: { ts: Date.now(), places } });
      }

      for (const place of places ?? []) {
        if (this.store.isProcessed(place.displayName)) continue;
        const existing = this.store.getAllLeads().find(
          (l) => l.businessName.toLowerCase() === place.displayName.toLowerCase()
        );
        if (existing) {
          this.store.markProcessed(place.displayName);
          continue;
        }
        fresh.push({ name: place.displayName, place });
        if (fresh.length >= max) break;
      }

      this.rotateIndex = (this.rotateIndex + 1) % locations.length;
      if (fresh.length >= max) break;
    }

    return fresh;
  }

  private async processLead(lead: { name: string; place: any }, category: BusinessCategory, existingLeadId?: string) {
    const leadId = existingLeadId ?? `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const existing = existingLeadId ? this.store.getLead(existingLeadId) : undefined;
    const record: LeadRecord = {
      id: leadId,
      businessName: lead.name,
      category,
      location: lead.place?.formattedAddress,
      sourceUrl: lead.place?.googleMapsUrl,
      phone: lead.place?.phone ?? existing?.phone,
      status: "discovered",
      discoveredAt: existing?.discoveredAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.upsertLead(record);
    if (!existingLeadId) this.store.markProcessed(lead.name);

    this.telegram.send({ text: `🔍 Discovered: <b>${lead.name}</b> (${category.replace(/-/g, " ")}) — generating site…`, parseMode: "HTML" }).catch(() => {});

    const rawData = [
      `Business name: ${lead.place?.displayName}`,
      lead.place?.formattedAddress ? `Address: ${lead.place.formattedAddress}` : "",
      lead.place?.phone ? `Phone: ${lead.place.phone}` : "",
      lead.place?.rating ? `Rating: ${lead.place.rating} (${lead.place.userRatingCount ?? 0} reviews)` : "",
      lead.place?.openingHoursText ? `Hours: ${lead.place.openingHoursText.join(", ")}` : "",
      ...(lead.place?.reviews ?? []).map((r: any) => `Review: "${r.text ?? ""}" — ${r.author} (${r.rating} stars)`),
    ].filter(Boolean).join("\n");

    // Enrich: scrape the business's own website (if any) for a real logo, photos,
    // contact email and page text so pricing/services are real, not invented.
    const placePhotos = this.places.photoUrls(lead.place?.photos);
    const enricher = new BusinessEnricher({ headless: true });
    let logoUrl: string | undefined;
    let gallery: string[] | undefined;
    let contactEmail: string | undefined;
    let usedRawData = rawData;
    try {
      const enriched = await this.withTimeout(
        enricher.enrich({
          name: lead.name,
          websiteUrl: lead.place?.websiteUri,
          placePhotos,
          location: lead.place?.formattedAddress,
        }),
        180_000, // 3 min hard cap — enrichment (headless social scraping) can hang
        `enrichment timed out for ${lead.name}`
      );
      logoUrl = enriched.logoUrl;
      gallery = enriched.gallery.length ? enriched.gallery : undefined;
      contactEmail = enriched.contactEmail;
      this.store.updateLead(leadId, { videos: enriched.videos?.length ? enriched.videos : undefined });
      if (enriched.pageText) {
        const textBlock = `WEBSITE CONTENT (${enriched.source}):\n${enriched.pageText}`;
        usedRawData = [rawData, textBlock].filter(Boolean).join("\n\n");
      }
    } catch (err) {
      console.error(`[autopilot] ${(err as Error).message}`);
      // enrichment is best-effort
    } finally {
      // Never let a hung browser close abort the rest of the lead pipeline.
      try {
        await this.withTimeout(enricher.close().catch(() => {}), 15_000, "enricher close timed out");
      } catch {
        // swallow — proceed without enrichment teardown
      }
    }

    try {
      const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      this.store.updateLead(leadId, { status: "previewing", jobId, contactEmail });

      const generated = await this.contentGen.generate({
        businessName: lead.name,
        category,
        socialProfiles: [],
        rawSocialData: usedRawData || `Business name: ${lead.name}\nCategory: ${category}`,
        logoUrl,
        gallery,
      });

      const cost = this.contentGen.clientInstance.getStats();
      this.dailyCostUSD += cost.totalCostUSD;

      const { buildSite } = await import("@demo-site-generator/deploy");
      const built = await buildSite(generated.business);
      const preview = await this.deployClient.deploy({ files: built.files, draft: true });

      this.store.updateLead(leadId, { status: "awaiting-approval", previewUrl: preview.url });
      this.store.addJob({
        id: jobId,
        leadId,
        businessName: lead.name,
        status: "awaiting-approval",
        previewUrl: preview.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Register with the API so a client payment can trigger go-live
      await this.registerSale({
        businessId: generated.business.id ?? leadId,
        businessName: lead.name,
        category,
        businessData: generated.business,
        previewUrl: preview.url,
        leadId,
        contactEmail,
      });

      // Auto-record the animated hero into a 10s MP4 for outreach (fire-and-forget)
      if (this.config.heroVideoDir) {
        this.recordHeroVideo(preview.url, lead.name);
      }

      if (this.mode === "auto") {
        // Full autopilot: send the demo to the client right away
        await this.approveAndSend(leadId, lead.name, preview.url);
        this.store.updateJob(jobId, { status: "approved" });
      } else {
        await this.telegram.send({
          text:
            `<b>New website ready for review</b>\n\n` +
            `🏢 ${lead.name} (${category.replace(/-/g, " ")})\n` +
            `💾 Lead: ${leadId}\n` +
            `💰 Cost: $${cost.totalCostUSD.toFixed(4)}\n\n` +
            `Preview: ${preview.url}\n\n` +
            `Review the site, then choose:`,
          parseMode: "HTML",
          buttons: [
            { text: "✅ Approve & send demo", callbackData: `approval:${jobId}:approve` },
            { text: "❌ Reject", callbackData: `approval:${jobId}:reject` },
            { text: "🔄 Regenerate", callbackData: `approval:${jobId}:regenerate` },
          ],
        });
      }
    } catch (err) {
      this.store.updateLead(leadId, { status: "failed" });
      this.telegram.send({ text: `❌ Failed to build site for ${lead.name}: ${(err as Error).message}` }).catch(() => {});
    }
  }

  /**
   * Approve a site and start the sales process: send the demo to the client,
   * begin the follow-up sequence.
   */
  private async approveAndSend(leadId: string, businessName: string, previewUrl?: string) {
    const lead = this.store.getLead(leadId);
    if (!lead || !previewUrl) {
      await this.telegram.send({ text: `⚠️ Cannot send demo for ${businessName} — missing preview URL.` }).catch(() => {});
      return;
    }

    this.store.updateLead(leadId, {
      status: "sent",
      sentAt: new Date().toISOString(),
      outreachStage: 0,
      lastOutreachAt: new Date().toISOString(),
    });

    const outcome = await this.deliverDemo(lead, previewUrl);

    const deliveredTo = outcome.channel === "email"
      ? `email (${outcome.to})`
      : outcome.channel === "whatsapp"
        ? `WhatsApp (${outcome.to})`
        : "— no email or WhatsApp found";

    await this.telegram.send({
      text:
        `✅ <b>Approved & demo sent</b>\n\n` +
        `🏢 ${businessName}\n` +
        `📤 Delivered via ${deliveredTo}\n` +
        `🔗 ${previewUrl}\n\n` +
        `Follow-up sequence scheduled. You'll be notified of replies and payments.`,
      parseMode: "HTML",
    }).catch(() => {});
  }

  /** Send the first-contact demo via email or WhatsApp. */
  private async deliverDemo(lead: LeadRecord, demoUrl: string): Promise<{ channel: "email" | "whatsapp" | "none"; to: string }> {
    const portalUrl = this.config.apiUrl ? `${this.config.apiUrl}/portal/${lead.id}` : undefined;
    const ctx = {
      businessName: lead.businessName,
      category: lead.category,
      demoUrl,
      senderName: this.config.outreach?.senderName ?? "",
      senderCompany: this.config.outreach?.senderCompany ?? "SiteCraft",
      city: lead.location?.split(",")[0],
      phone: lead.phone,
      email: lead.contactEmail,
      portalUrl,
      // Real-estate leads are discovered as agents who already have a website,
      // so the pitch is a walkthrough upgrade, not "you have no site".
      hasWebsite: lead.category === "real-estate-agent" || lead.category === "real-estate-developer",
    };

    if (lead.contactEmail && this.outreachManager) {
      await this.outreachManager.sendFirstContact(ctx);
      return { channel: "email", to: lead.contactEmail };
    }

    if (lead.phone && this.whatsapp) {
      const isRealEstate = lead.category === "real-estate-agent" || lead.category === "real-estate-developer";
      const body = isRealEstate
        ? `Hi,\n\nI put together a demo for ${lead.businessName} that lets buyers take a guided room-by-room walkthrough of a property before calling:\n\n${demoUrl}\n\n` +
          `It's a modern site with your real info, ready to go. Would it be useful if we made this yours?\n\n— ${ctx.senderName}\n${ctx.senderCompany}`
        : `Hi,\n\nI noticed ${lead.businessName} doesn't have a website yet. I went ahead and built a quick demo for you:\n\n${demoUrl}\n\n` +
          `It's a modern site with your real info, ready to go. Would it be useful if we made this yours?\n\n— ${ctx.senderName}\n${ctx.senderCompany}`;
      await this.whatsapp.sendText(WhatsAppClient.normalizePhone(lead.phone), body);
      return { channel: "whatsapp", to: lead.phone };
    }

    await this.telegram.send({
      text: `⚠️ <b>No contact channel for ${lead.businessName}</b>\n\nNo email or WhatsApp found for this lead. Send the demo manually:\n${demoUrl}`,
      parseMode: "HTML",
    }).catch(() => {});
    return { channel: "none", to: "" };
  }

  /** Advance the follow-up/breakup sequence for leads that have been contacted. */
  private async runFollowUps() {
    const now = Date.now();
    const day1 = this.config.followUpDay1 ?? 1;
    const day2 = this.config.followUpDay2 ?? 3;
    const breakup = this.config.breakupDay ?? 7;

    const due: LeadRecord[] = this.store
      .getLeadsByStatus("sent")
      .filter((l) => l.outreachStage === undefined || l.outreachStage < 3)
      .map((l) => ({ ...l }))
      .filter((l) => {
        const last = l.lastOutreachAt ? new Date(l.lastOutreachAt).getTime() : l.sentAt ? new Date(l.sentAt).getTime() : now;
        const days = (now - last) / 86_400_000;
        const stage = l.outreachStage ?? 0;
        if (stage === 0) return days >= day1;
        if (stage === 1) return days >= day2;
        if (stage === 2) return days >= breakup;
        return false;
      });

    for (const lead of due) {
      if (!this.running) break;
      const stage = lead.outreachStage ?? 0;
      const portalUrl = this.config.apiUrl ? `${this.config.apiUrl}/portal/${lead.id}` : undefined;
      const ctx = {
        businessName: lead.businessName,
        category: lead.category,
        demoUrl: lead.previewUrl ?? "",
        senderName: this.config.outreach?.senderName ?? "",
        senderCompany: this.config.outreach?.senderCompany ?? "SiteCraft",
        city: lead.location?.split(",")[0],
        phone: lead.phone,
        email: lead.contactEmail,
        portalUrl,
        hasWebsite: lead.category === "real-estate-agent" || lead.category === "real-estate-developer",
      };

      try {
        if (lead.contactEmail && this.outreachManager) {
          if (stage === 0) await this.outreachManager.sendFollowUp(ctx, 0);
          else if (stage === 1) await this.outreachManager.sendFollowUp(ctx, 1);
          else if (stage === 2) await this.outreachManager.sendBreakup(ctx);
        } else if (lead.phone && this.whatsapp) {
          const demoUrl = lead.previewUrl ?? "";
          let body = "";
          if (stage === 0) body = `Hi, just checking in — did you get a chance to look at the demo for ${lead.businessName}?\n\n${demoUrl}\n\nIf it's not quite right, I can change anything. — ${ctx.senderName}`;
          else if (stage === 1) body = `Hi ${lead.businessName.split(" ")[0]}, one quick question — did the demo make sense? It's still live:\n\n${demoUrl}\n\nIf you're not interested, no problem. — ${ctx.senderName}`;
          else body = `Closing the loop — I built a demo for ${lead.businessName} a few weeks back:\n\n${demoUrl}\n\nIf you ever want a modern website, it's ready. I won't email again.\n\n${ctx.senderName}`;
          await this.whatsapp.sendText(WhatsAppClient.normalizePhone(lead.phone), body);
        }

        const nextStage = stage + 1;
        this.store.updateLead(lead.id, {
          outreachStage: nextStage,
          lastOutreachAt: new Date().toISOString(),
          ...(nextStage >= 3 ? { status: "sent" } : {}),
        });
        await this.telegram.send({
          text: `📨 Follow-up ${nextStage} sent to <b>${lead.businessName}</b> (${lead.contactEmail ? "email" : "whatsapp"}).`,
          parseMode: "HTML",
        }).catch(() => {});
      } catch (err) {
        await this.telegram.send({ text: `⚠️ Follow-up failed for ${lead.businessName}: ${(err as Error).message}` }).catch(() => {});
      }
    }
  }

  private async registerSale(sale: {
    businessId: string;
    businessName: string;
    category: BusinessCategory;
    businessData: unknown;
    previewUrl: string;
    leadId: string;
    contactEmail?: string;
  }) {
    if (!this.config.apiUrl) return;
    try {
      await fetch(`${this.config.apiUrl}/api/sales/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sale),
      });
    } catch {
      // best-effort — payment gating falls back to manual go-live
    }
  }

  /** Spawn the hero recorder (detached, fire-and-forget) to create a 15s MP4. */
  private recordHeroVideo(previewUrl: string, businessName: string) {
    try {
      const script = this.config.recordHeroScript ?? "C:/Users/User/demo-site-generator/packages/scraper/record-hero.ts";
      const child = spawn("node", ["--import", "tsx", script, previewUrl, businessName, this.config.heroVideoDir!, "15", "12"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch {
      // recording is best-effort
    }
  }

  /** Forward a Telegram update the autopilot doesn't own to the API. */
  private async forwardToSupport(update: unknown) {    if (!this.config.apiUrl) return;
    try {
      await fetch(`${this.config.apiUrl}/api/support/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    } catch {
      // best-effort — API may be offline
    }
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Race a promise against a hard timeout so a hung external call can't stall the cycle. */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`⏱ ${label}`)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }
}
