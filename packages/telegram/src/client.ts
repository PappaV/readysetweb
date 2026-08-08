export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface TelegramMessage {
  chatId?: string;
  text: string;
  buttons?: InlineButton[];
  parseMode?: "HTML" | "Markdown";
  photoUrl?: string;
}

export interface TelegramConfig {
  botToken: string;
  adminChatId: string;
  pollIntervalMs?: number;
}

export class TelegramBot {
  private readonly token: string;
  private readonly adminChatId: string;
  private readonly pollIntervalMs: number;
  private readonly apiBase: string;
  private lastUpdateId = 0;
  private running = false;

  constructor(config: TelegramConfig) {
    this.token = config.botToken;
    this.adminChatId = config.adminChatId;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.apiBase = `https://api.telegram.org/bot${this.token}`;
  }

  async send(msg: TelegramMessage): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chat_id: msg.chatId || this.adminChatId,
      text: msg.text,
      disable_web_page_preview: false,
    };
    if (msg.parseMode) body.parse_mode = msg.parseMode;

    if (msg.buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [msg.buttons.map((b) => ({ text: b.text, callback_data: b.callbackData }))],
      };
    }

    const res = await fetch(`${this.apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Telegram sendMessage failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
    return { messageId: data.result?.message_id ?? 0 };
  }

  async sendPhoto(chatId: string, photoUrl: string, caption: string, buttons?: InlineButton[]): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: chatId || this.adminChatId,
      photo: photoUrl,
      caption,
    };
    if (buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.callbackData }))],
      };
    }

    const res = await fetch(`${this.apiBase}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Telegram sendPhoto failed (${res.status}): ${err}`);
    }
  }

  async answerCallback(callbackQueryId: string, text?: string) {
    await fetch(`${this.apiBase}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text ?? "" }),
    }).catch(() => {});
  }

  async editMessage(chatId: string, messageId: number, text: string, buttons?: InlineButton[]) {
    const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
    if (buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.callbackData }))],
      };
    }
    await fetch(`${this.apiBase}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async deleteMessage(chatId: string, messageId: number) {
    await fetch(`${this.apiBase}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    }).catch(() => {});
  }

  async startPolling(onUpdate: (update: TelegramUpdate) => Promise<unknown>): Promise<void> {
    if (this.running) return;
    this.running = true;

    const loop = async () => {
      if (!this.running) return;
      try {
        const res = await fetch(
          `${this.apiBase}/getUpdates?timeout=30&offset=${this.lastUpdateId + 1}&allowed_updates=["message","callback_query"]`
        );
        if (res.ok) {
          const data = (await res.json()) as { result?: TelegramUpdate[] };
          for (const update of data.result ?? []) {
            if (update.update_id >= this.lastUpdateId) this.lastUpdateId = update.update_id;
            await onUpdate(update);
          }
        }
      } catch {
        // transient network error — keep polling
      }
      setTimeout(loop, this.pollIntervalMs);
    };

    loop();
  }

  stopPolling() {
    this.running = false;
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}
