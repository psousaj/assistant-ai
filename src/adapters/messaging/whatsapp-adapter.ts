import { env } from "@/config/env";
import type { MessagingProvider, IncomingMessage, ProviderType } from "./types";

/**
 * Adapter para Meta WhatsApp Business API
 */
export class WhatsAppAdapter implements MessagingProvider {
  private baseUrl = "https://graph.facebook.com/v24.0";
  private token = env.META_WHATSAPP_TOKEN;
  private phoneNumberId = env.META_WHATSAPP_PHONE_NUMBER_ID;

  getProviderName(): ProviderType {
    return "whatsapp";
  }

  parseIncomingMessage(payload: any): IncomingMessage | null {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message?.text?.body) {
      return null;
    }

    // Extrai nome do contato
    const contact = value?.contacts?.[0];
    const senderName = contact?.profile?.name;

    // Phone number é o externalId no WhatsApp
    const phoneNumber = message.from;

    return {
      messageId: message.id,
      externalId: phoneNumber,
      senderName,
      text: message.text.body,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      provider: "whatsapp",
      phoneNumber, // WhatsApp sempre tem telefone
    };
  }

  verifyWebhook(request: any): boolean {
    // TODO: Implementar validação HMAC SHA256
    // Suporta tanto Fetch API quanto Express
    // const signature = request.headers?.get?.("X-Hub-Signature-256") || 
    //                  request.headers?.["x-hub-signature-256"];
    // const body = await request.text();
    // return validateSignature(signature, body, env.META_WHATSAPP_VERIFY_TOKEN);
    return true;
  }

  async sendMessage(to: string, text: string): Promise<void> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${error}`);
    }
  }

  /**
   * Marca mensagem como lida (método específico WhatsApp)
   */
  async markAsRead(messageId: string): Promise<void> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
