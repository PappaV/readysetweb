import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CheckoutRequest,
  CheckoutResponse,
  PaymentEvent,
  PaymentProviderClient,
} from "./types";

export interface PaystackConfig {
  secretKey: string;
  baseUrl?: string;
  callbackUrl?: string;
}

const DEFAULT_BASE = "https://api.paystack.co";

export class PaystackProvider implements PaymentProviderClient {
  readonly provider = "paystack" as const;
  private readonly config: PaystackConfig;

  constructor(config: PaystackConfig) {
    this.config = config;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const body: Record<string, unknown> = {
      email: req.buyerEmail ?? "buyer@example.com",
      amount: Math.round(req.amount.amount * 100), // kobo / minor units
      currency: req.amount.currency,
      reference: req.orderId,
      metadata: {
        description: req.description,
        order_id: req.orderId,
        ...req.metadata,
      },
      ...(req.returnUrl ? { callback_url: req.returnUrl } : {}),
    };

    const res = await fetch(`${this.config.baseUrl ?? DEFAULT_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Paystack initialize failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; reference?: string };
    };

    if (!data.status || !data.data?.authorization_url) {
      throw new Error("Paystack initialize returned no authorization URL");
    }

    return {
      provider: "paystack",
      redirectUrl: data.data.authorization_url,
      orderId: req.orderId,
    };
  }

  handleWebhook(body: unknown, headers: Record<string, string>): PaymentEvent {
    const signature = headers["x-paystack-signature"] ?? "";
    const rawBody = typeof body === "string" ? body : JSON.stringify(body);
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error("Paystack webhook signature verification failed");
    }

    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const event = (payload as { event?: string }).event ?? "";
    const data = (payload as { data?: Record<string, unknown> }).data ?? {};

    const amount = Number(data["amount"] ?? 0) / 100;
    const status = data["status"] as string;
    const eventType =
      event === "charge.success" && status === "success"
        ? "payment.success"
        : event === "charge.failed"
          ? "payment.failed"
          : "payment.pending";

    return {
      provider: "paystack",
      eventType,
      orderId: (data["reference"] as string) ?? "",
      reference: (data["reference"] as string) ?? "",
      amount,
      currency: (data["currency"] as string) ?? "NGN",
      paidAt: (data["paid_at"] as string) ?? undefined,
      raw: data,
    };
  }

  private verifySignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const expected = createHmac("sha512", this.config.secretKey).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
