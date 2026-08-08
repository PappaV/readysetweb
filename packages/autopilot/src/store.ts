import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type LeadStatus = "discovered" | "previewing" | "awaiting-approval" | "approved" | "rejected" | "sent" | "delivered" | "failed";

export interface LeadRecord {
  id: string;
  businessName: string;
  category: string;
  location?: string;
  sourceUrl?: string;
  status: LeadStatus;
  jobId?: string;
  previewUrl?: string;
  deployedUrl?: string;
  contactEmail?: string;
  phone?: string;
  /** When the first demo was sent to the client */
  sentAt?: string;
  /** Which outreach step was last sent (0=first, 1=follow-up 1, 2=follow-up 2, 3=breakup) */
  outreachStage?: number;
  lastOutreachAt?: string;
  /** How many times a failed/stuck build has been retried */
  retryCount?: number;
  discoveredAt: string;
  updatedAt: string;
}

export interface JobRecord {
  id: string;
  leadId: string;
  businessName: string;
  status: string;
  previewUrl?: string;
  deployedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  leads: Record<string, LeadRecord>;
  jobs: Record<string, JobRecord>;
  processedNames: string[];
  meta: Record<string, unknown>;
}

export class PersistentStore {
  private readonly filePath: string;
  private data: StoreData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): StoreData {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf-8")) as StoreData;
        if (parsed?.leads && parsed?.processedNames) return parsed;
      } catch {
        // corrupt file — start fresh
      }
    }
    return { leads: {}, jobs: {}, processedNames: [], meta: {} };
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  /** Returns true if this business was already processed/contacted */
  isProcessed(name: string): boolean {
    const key = name.toLowerCase().trim();
    return this.data.processedNames.includes(key);
  }

  markProcessed(name: string) {
    const key = name.toLowerCase().trim();
    if (!this.data.processedNames.includes(key)) {
      this.data.processedNames.push(key);
      this.save();
    }
  }

  upsertLead(lead: LeadRecord): LeadRecord {
    this.data.leads[lead.id] = lead;
    this.save();
    return lead;
  }

  getLead(id: string): LeadRecord | undefined {
    return this.data.leads[id];
  }

  updateLead(id: string, patch: Partial<LeadRecord>): LeadRecord {
    const existing = this.data.leads[id];
    if (!existing) throw new Error(`Lead ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.data.leads[id] = updated;
    this.save();
    return updated;
  }

  addJob(job: JobRecord) {
    this.data.jobs[job.id] = job;
    this.save();
  }

  updateJob(id: string, patch: Partial<JobRecord>): JobRecord {
    const existing = this.data.jobs[id];
    if (!existing) throw new Error(`Job ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.data.jobs[id] = updated;
    this.save();
    return updated;
  }

  getJob(id: string): JobRecord | undefined {
    return this.data.jobs[id];
  }

  getLeadsByStatus(status: LeadStatus): LeadRecord[] {
    return Object.values(this.data.leads).filter((l) => l.status === status);
  }

  getAllLeads(): LeadRecord[] {
    return Object.values(this.data.leads).sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  }

  getAllJobs(): JobRecord[] {
    return Object.values(this.data.jobs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getStats() {
    const leads = Object.values(this.data.leads);
    return {
      totalLeads: leads.length,
      discovered: leads.filter((l) => l.status === "discovered").length,
      previewing: leads.filter((l) => l.status === "previewing").length,
      awaitingApproval: leads.filter((l) => l.status === "awaiting-approval").length,
      approved: leads.filter((l) => l.status === "approved").length,
      sent: leads.filter((l) => l.status === "sent").length,
      delivered: leads.filter((l) => l.status === "delivered").length,
      rejected: leads.filter((l) => l.status === "rejected").length,
      failed: leads.filter((l) => l.status === "failed").length,
      totalJobs: Object.keys(this.data.jobs).length,
      processedCompanies: this.data.processedNames.length,
    };
  }

  upsertMeta(patch: Record<string, unknown>) {
    this.data.meta = { ...this.data.meta, ...patch };
    this.save();
  }

  getMeta(): Record<string, unknown> {
    return this.data.meta;
  }
}
