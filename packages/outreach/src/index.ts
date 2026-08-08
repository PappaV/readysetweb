export { EmailSender } from "./sender";
export type { ProviderConfig, ResendConfig, SMTPConfig, SendResult } from "./sender";
export { OutreachManager } from "./manager";
export type { OutreachSchedule, OutreachRecord } from "./manager";
export { buildEmailTemplates } from "./templates";
export type { OutreachContext, EmailMessage } from "./templates";
export { WhatsAppClient } from "./whatsapp";
export type { WhatsAppConfig, WhatsAppSendResult } from "./whatsapp";
