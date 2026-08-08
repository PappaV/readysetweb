import { PayFastProvider, PayFastConfig } from "./payfast";
import { PaystackProvider, PaystackConfig } from "./paystack";
import { PayFastSubscriptions, PayFastApiConfig } from "./payfast-subscriptions";
import { CheckoutRequest, CheckoutResponse, PaymentEvent, PaymentProvider, PaymentProviderClient, SubscriptionClient, SubscriptionSummary, RecurringRequest } from "./types";

export type PaymentProviderConfig =
  | { provider: "payfast"; config: PayFastConfig }
  | { provider: "paystack"; config: PaystackConfig };

export class PaymentClient {
  private readonly provider: PaymentProviderClient;

  constructor(providerConfig: PaymentProviderConfig) {
    if (providerConfig.provider === "payfast") {
      this.provider = new PayFastProvider(providerConfig.config);
    } else {
      this.provider = new PaystackProvider(providerConfig.config);
    }
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    return this.provider.createCheckout(req);
  }

  handleWebhook(body: unknown, headers: Record<string, string> = {}): PaymentEvent {
    return this.provider.handleWebhook(body, headers);
  }
}

export { PayFastProvider, PaystackProvider, PayFastSubscriptions };
export type { PayFastConfig, PaystackConfig, PayFastApiConfig, CheckoutRequest, CheckoutResponse, PaymentEvent, PaymentProviderClient, SubscriptionClient, SubscriptionSummary, RecurringRequest, PaymentProvider };
