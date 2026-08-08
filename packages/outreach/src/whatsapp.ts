export interface WhatsAppConfig {
  instanceId: string;
  apiToken: string;
}

export interface WhatsAppSendResult {
  id: string;
  provider: "ultramsg";
  to: string;
  sentAt: string;
}

/**
 * UltraMsg WhatsApp gateway. Used to deliver demo links to businesses
 * when no email address is available (many SA SMBs use WhatsApp).
 */
export class WhatsAppClient {
  private readonly instanceId: string;
  private readonly apiToken: string;

  constructor(config: WhatsAppConfig) {
    this.instanceId = config.instanceId;
    this.apiToken = config.apiToken;
  }

  /** Send a plain text message to a phone number (E.164, digits only). */
  async sendText(to: string, body: string): Promise<WhatsAppSendResult> {
    const res = await fetch(`https://api.ultramsg.com/${this.instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: this.apiToken,
        to,
        body,
        priority: 10,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`UltraMsg sendText failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { messageId?: string; error?: string };
    if (data.error) throw new Error(`UltraMsg error: ${data.error}`);
    return { id: data.messageId ?? "", provider: "ultramsg", to, sentAt: new Date().toISOString() };
  }

  /** Validate/format a phone number into digits-only E.164 for WhatsApp. */
  static normalizePhone(phone: string): string {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.startsWith("27") || digits.startsWith("00")) return digits.replace(/^00/, "27");
    if (digits.startsWith("0")) return `27${digits.slice(1)}`;
    return digits;
  }
}
