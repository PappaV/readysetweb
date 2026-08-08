import { BusinessCategory } from "@demo-site-generator/shared";
import { ContentGenerator } from "@demo-site-generator/content-ai";
import { EmailSender, ProviderConfig } from "@demo-site-generator/outreach";
import { TelegramBot } from "@demo-site-generator/telegram";
import { ConversationStore, MessageChannel } from "./conversations";

export interface IngestInput {
  businessName: string;
  businessId?: string;
  leadId?: string;
  clientName?: string;
  clientEmail?: string;
  text: string;
  channel: MessageChannel;
}

const REPLY_PREFIX = "reply:";

export class SupportManager {
  private readonly conversations: ConversationStore;
  private readonly contentGen: ContentGenerator;
  private readonly telegram?: TelegramBot;
  private readonly email?: EmailSender;

  constructor(config: {
    conversations: ConversationStore;
    contentGen: ContentGenerator;
    telegram?: TelegramBot;
    email?: EmailSender;
  }) {
    this.conversations = config.conversations;
    this.contentGen = config.contentGen;
    this.telegram = config.telegram;
    this.email = config.email;
  }

  get store() {
    return this.conversations;
  }

  /** Handle a new client message (widget or email). AI drafts a reply, admin approves. */
  async ingest(input: IngestInput): Promise<void> {
    const conversation = this.conversations.findOrCreate({
      businessId: input.businessId,
      businessName: input.businessName,
      leadId: input.leadId,
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      channel: input.channel,
    });

    const clientMsg = this.conversations.addMessage(conversation.id, {
      direction: "client",
      channel: input.channel,
      text: input.text.slice(0, 2000),
      status: "received",
    });

    // Draft an AI reply
    try {
      const history = this.conversations
        .getMessages(conversation.id)
        .filter((m) => m.direction === "client" || m.direction === "admin")
        .slice(-6)
        .map((m) => ({ role: m.direction === "client" ? ("client" as const) : ("admin" as const), text: m.text }));

      const draft = await this.contentGen.draftReply({
        businessName: conversation.businessName,
        category: (input as { category?: BusinessCategory }).category ?? "boutique-hospitality",
        clientQuestion: input.text,
        history,
      });

      this.conversations.updateMessage(conversation.id, clientMsg.id, {
        status: "pending-approval",
        aiDraft: draft.reply,
      });
      this.conversations.update(conversation.id, { status: "negotiating" });

      await this.notifyAdmin(conversation.id, clientMsg.id, conversation.businessName, input.text, input.channel, draft.reply, draft.recommendations);
    } catch (err) {
      this.conversations.updateMessage(conversation.id, clientMsg.id, { status: "rejected" });
      await this.telegram?.send({
        text: `⚠️ AI reply draft failed for ${conversation.businessName}: ${(err as Error).message}`,
      }).catch(() => {});
    }
  }

  /** Approve + deliver an AI-drafted reply to the client. */
  async approveReply(conversationId: string, messageId: string, callbackQueryId?: string): Promise<void> {
    const msg = this.conversations.getMessages(conversationId).find((m) => m.id === messageId);
    if (!msg?.aiDraft) throw new Error(`No draft for message ${messageId}`);

    this.conversations.updateMessage(conversationId, messageId, { status: "sent" });

    const conversation = this.conversations.get(conversationId);
    if (conversation?.clientEmail && this.email) {
      await this.email.send(
        conversation.clientEmail,
        `Re: ${conversation.businessName} website`,
        msg.aiDraft
      );
    }

    if (callbackQueryId) await this.telegram?.answerCallback(callbackQueryId, "Reply sent to client");
    await this.telegram?.send({
      text: `✅ Reply sent to <b>${conversation?.businessName ?? conversationId}</b>${conversation?.clientEmail ? ` (${conversation.clientEmail})` : ""} via ${conversation?.channel ?? "widget"}.`,
      parseMode: "HTML",
    }).catch(() => {});
  }

  /** Discard an AI-drafted reply. */
  async rejectReply(conversationId: string, messageId: string, callbackQueryId?: string): Promise<void> {
    this.conversations.updateMessage(conversationId, messageId, { status: "rejected" });
    if (callbackQueryId) await this.telegram?.answerCallback(callbackQueryId, "Reply discarded");
  }

  /** Admin sends a manual reply directly (e.g. via /reply <convId> <text>). */
  async sendManual(conversationId: string, text: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error(`Unknown conversation ${conversationId}`);

    const msg = this.conversations.addMessage(conversationId, {
      direction: "admin",
      channel: "telegram",
      text,
      status: "sent",
    });

    if (conversation.clientEmail && this.email) {
      await this.email.send(conversation.clientEmail, `Re: ${conversation.businessName} website`, text);
    }
    await this.telegram?.send({ text: `✅ Manual reply sent to ${conversation.businessName}.` }).catch(() => {});
    return;
  }

  /** Handle Telegram callbacks/commands for reply approvals. */
  async handleTelegram(update: {
    callback_query?: { id: string; data?: string };
    message?: { text?: string };
  }): Promise<boolean> {
    if (update.message?.text) {
      const text = update.message.text.trim();
      if (text.startsWith("/reply ")) {
        const [cmd, convId, ...rest] = text.split(" ");
        const reply = rest.join(" ");
        if (cmd === "/reply" && convId && reply) {
          try {
            await this.sendManual(convId, reply);
            return true;
          } catch (err) {
            await this.telegram?.send({ text: `⚠️ ${(err as Error).message}` }).catch(() => {});
            return true;
          }
        }
      }
      if (text === "/conversations") {
        const convs = this.conversations.getAllConversations().filter((c) => c.status !== "closed").slice(0, 15);
        const lines = [
          `<b>Open conversations</b>`,
          ``,
          ...convs.map((c) => `• ${c.businessName} — ${c.channel} (${c.status}) — <code>${c.id}</code>`),
        ];
        await this.telegram?.send({ text: lines.join("\n"), parseMode: "HTML" }).catch(() => {});
        return true;
      }
      return false;
    }

    const cb = update.callback_query;
    if (!cb?.data?.startsWith(REPLY_PREFIX)) return false;
    const [, convId, msgId, action] = cb.data.split(":");
    if (action === "approve") {
      await this.approveReply(convId, msgId, cb.id);
    } else if (action === "reject") {
      await this.rejectReply(convId, msgId, cb.id);
      await this.telegram?.send({ text: "❌ Reply discarded." }).catch(() => {});
    }
    return true;
  }

  private async notifyAdmin(
    conversationId: string,
    messageId: string,
    businessName: string,
    clientText: string,
    channel: MessageChannel,
    draft: string,
    recommendations: string[]
  ): Promise<void> {
    if (!this.telegram) return;
    const recLines = recommendations.length
      ? [``, `<b>Recommended changes:</b>`, ...recommendations.map((r) => `• ${r}`)]
      : [];
    const lines = [
      `<b>💬 New client message</b>`,
      ``,
      `🏢 ${businessName}`,
      `📡 ${channel === "email" ? "Email" : "Website chat"}`,
      ``,
      `<b>Client:</b> ${clientText.slice(0, 600)}`,
      ``,
      `<b>AI draft reply:</b>`,
      draft,
      ...recLines,
      ``,
      `Send the draft, edit it, or discard:`,
    ];

    await this.telegram.send({
      text: lines.join("\n"),
      parseMode: "HTML",
      buttons: [
        { text: "✅ Send", callbackData: `${REPLY_PREFIX}${conversationId}:${messageId}:approve` },
        { text: "✏️ Edit (/reply)", callbackData: `${REPLY_PREFIX}${conversationId}:${messageId}:reject` },
        { text: "❌ Discard", callbackData: `${REPLY_PREFIX}${conversationId}:${messageId}:reject` },
      ],
    }).catch(() => {});
  }
}
