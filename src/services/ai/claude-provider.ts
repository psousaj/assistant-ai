import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIResponse, Message } from "./types";

/**
 * Provider para Anthropic Claude API
 */
export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-5-sonnet-20241022") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { message, history = [], systemPrompt } = params;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const content = response.content[0];
      if (content.type === "text") {
        return {
          message: content.text,
        };
      }

      return {
        message: "Desculpe, não consegui processar sua mensagem.",
      };
    } catch (error: any) {
      console.error("Erro ao chamar Claude:", error);

      // Erro de API key inválida
      if (error?.status === 401) {
        return {
          message:
            "⚠️ Anthropic API key inválida. Configure ANTHROPIC_API_KEY no .env",
        };
      }

      // Erro de rate limit
      if (error?.status === 429) {
        return {
          message:
            "⚠️ Limite de requisições atingido. Tente novamente em alguns minutos.",
        };
      }

      return {
        message: "⚠️ Serviço de IA indisponível. Tente novamente mais tarde.",
      };
    }
  }

  getName(): string {
    return "claude";
  }
}
