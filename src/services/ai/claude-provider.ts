import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIResponse, Message } from "./types";
import { availableTools } from "./tools";

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
      // Converter tools para formato Claude
      const claudeTools = availableTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: claudeTools,
      });

      // Verifica se há tool use
      const toolUseBlock = response.content.find(
        (block) => block.type === "tool_use"
      );

      if (toolUseBlock && toolUseBlock.type === "tool_use") {
        return {
          message: "", // Vazio quando tem tool calls
          tool_calls: [
            {
              id: toolUseBlock.id,
              type: "function" as const,
              function: {
                name: toolUseBlock.name,
                arguments: JSON.stringify(toolUseBlock.input),
              },
            },
          ],
        };
      }

      // Resposta de texto normal
      const content = response.content[0];
      if (content.type === "text") {
        return {
          message: content.text,
        };
      }

      return {
        message:
          "😅 Hmm... não consegui processar sua mensagem. Tenta de novo?",
      };
    } catch (error: any) {
      console.error("Erro ao chamar Claude:", error);

      // Erro de API key inválida
      if (error?.status === 401) {
        return {
          message:
            "😅 Hmm... estou com problemas de configuração aqui. Pode tentar novamente mais tarde?",
        };
      }

      // Erro de rate limit
      if (error?.status === 429) {
        return {
          message:
            "😅 Opa, muitas mensagens de uma vez! Dá uma pausa de uns minutinhos e tenta de novo?",
        };
      }

      return {
        message:
          "😅 Hmm... estou com problemas pra te responder no momento. Pode tentar novamente mais tarde?",
      };
    }
  }

  getName(): string {
    return "claude";
  }
}
