import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type SaleStatus = "preview" | "negotiating" | "approved" | "paid" | "live" | "failed";

export interface PendingSale {
  businessId: string;
  businessName: string;
  category: string;
  businessData: unknown;
  previewUrl?: string;
  deployedUrl?: string;
  leadId?: string;
  contactEmail?: string;
  status: SaleStatus;
  /** Proposed custom domain, created only after payment */
  domain?: string;
  domainStatus?: "pending-provision" | "provisioning" | "live";
  /** Professional email on the client's own domain (created after payment) */
  professionalEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  sales: Record<string, PendingSale>;
}

export class SalesStore {
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
        if (parsed?.sales) return parsed;
      } catch {
        // corrupt — start fresh
      }
    }
    return { sales: {} };
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  upsert(sale: PendingSale): PendingSale {
    this.data.sales[sale.businessId] = { ...sale, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.sales[sale.businessId];
  }

  get(businessId: string): PendingSale | undefined {
    return this.data.sales[businessId];
  }

  update(businessId: string, patch: Partial<PendingSale>): PendingSale | undefined {
    const existing = this.data.sales[businessId];
    if (!existing) return undefined;
    this.data.sales[businessId] = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.save();
    return this.data.sales[businessId];
  }

  getAll(): PendingSale[] {
    return Object.values(this.data.sales).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
