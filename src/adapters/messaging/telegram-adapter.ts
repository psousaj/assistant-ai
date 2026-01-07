import { env } from "@/config/env";
import type { MessagingProvider, IncomingMessage, ProviderType } from "./types";

/**
 * Adapter para Telegram Bot API
 */
export class TelegramAdapter implements MessagingProvider {
  private baseUrl = "https://api.telegram.org";
  private token = env.TELEGRAM_BOT_TOKEN;
  private webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

  getProviderName(): ProviderType {
    return "telegram";
  }

  parseIncomingMessage(payload: any): IncomingMessage | null {
    const message = payload.message;

    if (!message?.text) {
      return null;
    }

    // Telegram usa chat.id como identificador único
    const chatId = message.chat.id.toString();

    // Nome: prioriza username, fallback para first_name
    const senderName =
      message.from.username ||
      `${message.from.first_name}${
        message.from.last_name ? " " + message.from.last_name : ""
      }`.trim();

    // Telefone: raramente disponível (apenas se usuário compartilhou contato)
    const phoneNumber = message.contact?.phone_number;

    return {
      messageId: message.message_id.toString(),
      externalId: chatId,
      senderName,
      text: message.text,
      timestamp: new Date(message.date * 1000),
      provider: "telegram",
      phoneNumber,
    };
  }

  verifyWebhook(request: Request): boolean {
    // Telegram webhook secret (opcional)
    if (!this.webhookSecret) {
      return true;
    }

    const secretToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    return secretToken === this.webhookSecret;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const url = `${this.baseUrl}/bot${this.token}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text,
      parse_mode: undefined, // Texto puro, sem Markdown/HTML
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${error}`);
    }
  }

  /**
   * Define webhook do Telegram (usar em setup inicial)
   */
  async setWebhook(webhookUrl: string): Promise<void> {
    const url = `${this.baseUrl}/bot${this.token}/setWebhook`;

    const payload = {
      url: webhookUrl,
      secret_token: this.webhookSecret,
      allowed_updates: ["message"],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram setWebhook error: ${error}`);
    }
  }
}

export const telegramAdapter = new TelegramAdapter();
