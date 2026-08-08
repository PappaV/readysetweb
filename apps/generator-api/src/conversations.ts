import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type MessageDirection = "client" | "admin" | "system";
export type MessageChannel = "widget" | "email" | "telegram";
export type MessageStatus = "received" | "draft" | "pending-approval" | "sent" | "rejected";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  channel: MessageChannel;
  text: string;
  status: MessageStatus;
  /** Admin-only: AI-drafted reply text awaiting approval */
  aiDraft?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  businessId?: string;
  businessName: string;
  leadId?: string;
  clientEmail?: string;
  clientName?: string;
  channel: MessageChannel;
  status: "open" | "negotiating" | "won" | "closed";
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  conversations: Record<string, Conversation>;
  messages: Record<string, ConversationMessage[]>;
}

export class ConversationStore {
  private readonly filePath: string;
  private data: StoreData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): StoreData {
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf-8")) as StoreData;
        if (parsed?.conversations && parsed?.messages) return parsed;
      } catch {
        // corrupt — start fresh
      }
    }
    return { conversations: {}, messages: {} };
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  findOrCreate(input: {
    businessId?: string;
    businessName: string;
    leadId?: string;
    clientEmail?: string;
    clientName?: string;
    channel: MessageChannel;
  }): Conversation {
    const existing = Object.values(this.data.conversations).find(
      (c) =>
        (input.businessId && c.businessId === input.businessId) ||
        (input.clientEmail && c.clientEmail?.toLowerCase() === input.clientEmail.toLowerCase()) ||
        (input.leadId && c.leadId === input.leadId)
    );
    if (existing) {
      const updated = { ...existing, ...input, updatedAt: new Date().toISOString() };
      this.data.conversations[updated.id] = updated;
      this.save();
      return updated;
    }
    const conversation: Conversation = {
      id: `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      ...input,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.conversations[conversation.id] = conversation;
    this.data.messages[conversation.id] = [];
    this.save();
    return conversation;
  }

  get(id: string): Conversation | undefined {
    return this.data.conversations[id];
  }

  update(id: string, patch: Partial<Conversation>): Conversation | undefined {
    const existing = this.data.conversations[id];
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.data.conversations[id] = updated;
    this.save();
    return updated;
  }

  addMessage(conversationId: string, msg: Omit<ConversationMessage, "id" | "conversationId" | "createdAt">): ConversationMessage {
    const message: ConversationMessage = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      createdAt: new Date().toISOString(),
      ...msg,
    };
    this.data.messages[conversationId] = this.data.messages[conversationId] ?? [];
    this.data.messages[conversationId].push(message);
    this.save();
    return message;
  }

  updateMessage(conversationId: string, messageId: string, patch: Partial<ConversationMessage>): ConversationMessage | undefined {
    const list = this.data.messages[conversationId] ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    if (idx < 0) return undefined;
    list[idx] = { ...list[idx], ...patch };
    this.save();
    return list[idx];
  }

  getMessages(conversationId: string, after?: string): ConversationMessage[] {
    const list = this.data.messages[conversationId] ?? [];
    return after ? list.filter((m) => m.createdAt > after) : list;
  }

  getAllConversations(): Conversation[] {
    return Object.values(this.data.conversations).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
