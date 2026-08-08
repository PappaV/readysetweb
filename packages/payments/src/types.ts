export type PaymentProvider = "payfast" | "paystack";

export interface PaymentAmount {
  amount: number;
  currency: "ZAR" | "USD" | "NGN";
}

export interface CheckoutRequest {
  orderId: string;
  description: string;
  amount: PaymentAmount;
  buyerEmail?: string;
  buyerName?: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
  /** Enable recurring billing (subscription) */
  recurring?: RecurringRequest;
}

export interface RecurringRequest {
  /** Amount to bill each cycle */
  amount: number;
  /** ISO date string for the first charge, e.g. "2026-09-01" */
  billingDate?: string;
  /** Billing frequency in days: PayFast uses 3 = monthly, 4 = quarterly, 6 = annual */
  frequency?: "monthly" | "quarterly" | "annual";
  /** Number of cycles (0 = until cancelled) */
  cycles?: number;
}

export interface CheckoutResponse {
  provider: PaymentProvider;
  /** URL to redirect the buyer to (Paystack) or self-submitting form HTML (PayFast) */
  redirectUrl?: string;
  /** Self-submitting form HTML for PayFast */
  formHtml?: string;
  orderId: string;
}

export interface PaymentEvent {
  provider: PaymentProvider;
  eventType: "payment.success" | "payment.failed" | "payment.pending";
  orderId: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  /** Present when the payment is a recurring subscription charge */
  subscriptionId?: string;
  /** True when this is the initial signup of a subscription */
  isSubscriptionStart?: boolean;
  raw: Record<string, unknown>;
}

export interface PaymentProviderClient {
  provider: PaymentProvider;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResponse>;
  /** Parse and validate an incoming webhook/notify payload. Throws if invalid. */
  handleWebhook(body: unknown, headers: Record<string, string>): PaymentEvent;
}

/** Recurring subscription management (provider-specific via API token) */
export interface SubscriptionClient {
  listSubscriptions(): Promise<SubscriptionSummary[]>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(subscriptionId: string): Promise<SubscriptionSummary | undefined>;
}

export interface SubscriptionSummary {
  subscriptionId: string;
  status: "active" | "cancelled" | "expired" | "unknown";
  planName: string;
  amount: number;
  currency: string;
  nextBillingDate?: string;
  frequencyLabel?: string;
}
