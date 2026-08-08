export type OutreachProvider = "resend" | "smtp";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
}

export type ProviderConfig = { provider: "resend"; config: ResendConfig } | { provider: "smtp"; config: SMTPConfig };

export interface SendResult {
  id: string;
  provider: OutreachProvider;
  to: string;
  sentAt: string;
}

export class EmailSender {
  private readonly providerConfig: ProviderConfig;

  constructor(providerConfig: ProviderConfig) {
    this.providerConfig = providerConfig;
  }

  async send(to: string, subject: string, body: string): Promise<SendResult> {
    if (this.providerConfig.provider === "resend") {
      return this.sendResend(to, subject, body);
    }
    return this.sendSMTP(to, subject, body);
  }

  private async sendResend(to: string, subject: string, body: string): Promise<SendResult> {
    const cfg = this.providerConfig.config as ResendConfig;
    const fromName = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromName,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Resend failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { id: string };
    return { id: data.id, provider: "resend", to, sentAt: new Date().toISOString() };
  }

  private async sendSMTP(to: string, subject: string, body: string): Promise<SendResult> {
    const { default: nodemailer } = await import("nodemailer");
    const cfg = this.providerConfig.config as SMTPConfig;
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    const info = await transporter.sendMail({
      from: cfg.fromName ? `"${cfg.fromName}" <${cfg.fromEmail}>` : cfg.fromEmail,
      to,
      subject,
      text: body,
    });

    return { id: String(info.messageId), provider: "smtp", to, sentAt: new Date().toISOString() };
  }
}
