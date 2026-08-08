import { EmailSender, ProviderConfig } from "./sender";
import { buildEmailTemplates, OutreachContext } from "./templates";

export interface OutreachSchedule {
  followUpDay1?: number;
  followUpDay2?: number;
  breakupDay?: number;
}

export interface OutreachRecord {
  contactEmail: string;
  sent: { step: string; date: string; messageId: string }[];
  status: "active" | "replied" | "bounced" | "completed";
}

export class OutreachManager {
  private readonly sender: EmailSender;
  private readonly records = new Map<string, OutreachRecord>();

  constructor(providerConfig: ProviderConfig) {
    this.sender = new EmailSender(providerConfig);
  }

  async sendFirstContact(ctx: OutreachContext): Promise<string> {
    const { first } = buildEmailTemplates(ctx);
    const result = await this.sender.send(first.to, first.subject, first.body);
    this.record(ctx.email ?? "", "first", result.id);
    return result.id;
  }

  async sendFollowUp(ctx: OutreachContext, followUpIndex: number): Promise<string> {
    const { followUps } = buildEmailTemplates(ctx);
    const template = followUps[followUpIndex];
    if (!template) throw new Error(`No follow-up template at index ${followUpIndex}`);
    const result = await this.sender.send(template.to, template.subject, template.body);
    this.record(ctx.email ?? "", `follow-up-${followUpIndex + 1}`, result.id);
    return result.id;
  }

  async sendBreakup(ctx: OutreachContext): Promise<string> {
    const { breakup } = buildEmailTemplates(ctx);
    const result = await this.sender.send(breakup.to, breakup.subject, breakup.body);
    this.record(ctx.email ?? "", "breakup", result.id);
    this.setStatus(ctx.email ?? "", "completed");
    return result.id;
  }

  markReplied(email: string) {
    this.setStatus(email, "replied");
  }

  markBounced(email: string) {
    this.setStatus(email, "bounced");
  }

  getRecord(email: string): OutreachRecord | undefined {
    return this.records.get(email);
  }

  getAllRecords(): OutreachRecord[] {
    return Array.from(this.records.values());
  }

  private record(email: string, step: string, messageId: string) {
    const existing = this.records.get(email) ?? { contactEmail: email, sent: [], status: "active" as const };
    existing.sent.push({ step, date: new Date().toISOString(), messageId });
    this.records.set(email, existing);
  }

  private setStatus(email: string, status: OutreachRecord["status"]) {
    const existing = this.records.get(email);
    if (existing) {
      existing.status = status;
      this.records.set(email, existing);
    }
  }
}
