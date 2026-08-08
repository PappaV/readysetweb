import { createHash } from "node:crypto";
import {
  CheckoutRequest,
  CheckoutResponse,
  PaymentEvent,
  PaymentProviderClient,
} from "./types";

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  sandbox?: boolean;
}

const SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
const LIVE_URL = "https://www.payfast.co.za/eng/process";
const SANDBOX_ITN_URL = "https://sandbox.payfast.co.za/eng/query/validate";
const LIVE_ITN_URL = "https://www.payfast.co.za/eng/query/validate";

const RECURRING_FREQ: Record<string, string> = {
  monthly: "3",
  quarterly: "4",
  annual: "6",
};

export class PayFastProvider implements PaymentProviderClient {
  readonly provider = "payfast" as const;
  private readonly config: PayFastConfig;

  constructor(config: PayFastConfig) {
    this.config = config;
  }

  get processUrl() {
    return this.config.sandbox ? SANDBOX_URL : LIVE_URL;
  }

  get validateUrl() {
    return this.config.sandbox ? SANDBOX_ITN_URL : LIVE_ITN_URL;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const data: Record<string, string> = {
      merchant_id: this.config.merchantId,
      merchant_key: this.config.merchantKey,
      m_payment_id: req.orderId,
      amount: req.amount.amount.toFixed(2),
      item_name: req.description,
      ...(req.buyerName ? { name_first: req.buyerName.split(" ")[0], name_last: req.buyerName.split(" ").slice(1).join(" ") } : {}),
      ...(req.buyerEmail ? { email_address: req.buyerEmail } : {}),
      ...(req.returnUrl ? { return_url: req.returnUrl } : {}),
      ...(req.cancelUrl ? { cancel_url: req.cancelUrl } : {}),
      ...(req.webhookUrl ? { notify_url: req.webhookUrl } : {}),
    };

    // Recurring billing
    if (req.recurring) {
      data.subscription = "1";
      data.recurring_amount = req.recurring.amount.toFixed(2);
      data.frequency = RECURRING_FREQ[req.recurring.frequency ?? "monthly"];
      if (req.recurring.billingDate) data.billing_date = req.recurring.billingDate;
      if (req.recurring.cycles !== undefined && req.recurring.cycles > 0) {
        data.cycles = String(req.recurring.cycles);
      }
    }

    if (req.metadata) {
      Object.entries(req.metadata).forEach(([k, v], i) => {
        if (i === 0) data.custom_str1 = v;
        if (i === 1) data.custom_str2 = v;
        if (i === 2) data.custom_str3 = v;
      });
    }

    const signature = this.sign(data);
    const formHtml = buildAutoSubmitForm(this.processUrl, data, signature);

    return {
      provider: "payfast",
      orderId: req.orderId,
      formHtml,
    };
  }

  handleWebhook(body: unknown): PaymentEvent {
    const payload = normalizePayload(body);
    const signature = payload["signature"];
    if (!signature || !this.verifySignature(payload, signature)) {
      throw new Error("PayFast ITN signature verification failed");
    }

    const status = payload["payment_status"] ?? "";
    const amount = Number(payload["amount_gross"] ?? payload["amount"] ?? 0);

    const eventType =
      status === "COMPLETE" || status === "COMPLETED"
        ? "payment.success"
        : status === "FAILED"
          ? "payment.failed"
          : "payment.pending";

    const subscriptionId =
      payload["recurring_payment_id"] ?? payload["token"] ?? payload["pf_subscription_id"];

    return {
      provider: "payfast",
      eventType,
      orderId: payload["m_payment_id"] ?? "",
      reference: payload["pf_payment_id"] ?? "",
      amount,
      currency: "ZAR",
      paidAt: payload["payment_date"] ?? undefined,
      subscriptionId: subscriptionId || undefined,
      isSubscriptionStart: !!(subscriptionId && payload["recurring_amount"]),
      raw: payload,
    };
  }

  verifySignature(payload: Record<string, string>, signature: string): boolean {
    const { signature: _sig, ...rest } = payload;
    return this.sign(rest) === signature;
  }

  async confirmPayment(payload: Record<string, string>): Promise<boolean> {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => body.append(k, v));

    const res = await fetch(this.validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) return false;
    const text = await res.text();
    return text.trim().toUpperCase() === "VALID";
  }

  private sign(data: Record<string, string>): string {
    const sorted = Object.keys(data)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(data[k]).replace(/%20/g, "+")}`)
      .join("&");

    const withPassphrase = this.config.passphrase ? `${sorted}&passphrase=${encodeURIComponent(this.config.passphrase)}` : sorted;
    return createHash("md5").update(withPassphrase).digest("hex");
  }
}

function normalizePayload(body: unknown): Record<string, string> {
  if (typeof body === "object" && body !== null) {
    const out: Record<string, string> = {};
    Object.entries(body as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    });
    return out;
  }
  if (typeof body === "string") {
    const out: Record<string, string> = {};
    new URLSearchParams(body).forEach((v, k) => (out[k] = v));
    return out;
  }
  return {};
}

function buildAutoSubmitForm(url: string, data: Record<string, string>, signature: string): string {
  const fields = Object.entries(data)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join("");
  return `<!doctype html>
<html>
<body>
<form action="${escapeHtml(url)}" method="post">
${fields}
<input type="hidden" name="signature" value="${signature}" />
<input type="submit" value="Proceed to Payment" style="display:none" />
</form>
<script>document.forms[0].submit();</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
