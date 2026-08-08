import {
  SubscriptionClient,
  SubscriptionSummary,
} from "./types";

export interface PayFastApiConfig {
  merchantId: string;
  apiToken: string;
  sandbox?: boolean;
}

const SANDBOX_API = "https://sandbox.payfast.co.za/api/v1";
const LIVE_API = "https://api.payfast.co.za/v1";

export class PayFastSubscriptions implements SubscriptionClient {
  private readonly config: PayFastApiConfig;

  constructor(config: PayFastApiConfig) {
    this.config = config;
  }

  private get baseUrl() {
    return this.config.sandbox ? SANDBOX_API : LIVE_API;
  }

  private async request<T>(path: string, method = "GET"): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "merchant-id": this.config.merchantId,
        "version": "v1",
        "signature": this.config.apiToken,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`PayFast API ${path} failed (${res.status}): ${err}`);
    }

    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error(
        `PayFast API returned the dashboard HTML instead of JSON — auth headers not accepted. ` +
        `Verify the PayFast API token and auth format (Settings → API).`
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`PayFast API returned non-JSON response for ${path}`);
    }
  }

  async listSubscriptions(): Promise<SubscriptionSummary[]> {
    const data = await this.request<{
      data?: Array<Record<string, unknown>>;
      subscriptions?: Array<Record<string, unknown>>;
    }>("/subscriptions");

    const list = data.data ?? data.subscriptions ?? [];
    return list.map((s) => this.normalize(s));
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionSummary | undefined> {
    const data = await this.request<{
      data?: Record<string, unknown>;
      subscription?: Record<string, unknown>;
    }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
    const item = data.data ?? data.subscription;
    return item ? this.normalize(item) : undefined;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, "PUT");
  }

  private normalize(s: Record<string, unknown>): SubscriptionSummary {
    const status = String(s.status ?? "unknown").toLowerCase();
    const mappedStatus: SubscriptionSummary["status"] =
      status.includes("active") ? "active"
      : status.includes("cancel") ? "cancelled"
      : status.includes("expire") ? "expired"
      : "unknown";

    return {
      subscriptionId: String(s.token ?? s.id ?? ""),
      status: mappedStatus,
      planName: String(s.item_name ?? s.plan ?? ""),
      amount: Number(s.recurring_amount ?? s.amount ?? 0),
      currency: String(s.currency ?? "ZAR"),
      nextBillingDate: s.next_billing_date ? String(s.next_billing_date) : undefined,
      frequencyLabel: String(s.frequency ?? s.frequency_label ?? ""),
    };
  }
}
