import { env } from "@/config/env";
import { GeminiProvider } from "./gemini-provider";
import { ClaudeProvider } from "./claude-provider";
import type { AIProvider, AIProviderType, AIResponse, Message } from "./types";

/**
 * Serviço AI multi-provider com fallback automático
 *
 * Default: Gemini (mais rápido e barato)
 * Fallback: Claude (mais sofisticado)
 */
export class AIService {
  private providers: Map<AIProviderType, AIProvider>;
  private defaultProvider: AIProviderType;
  private currentProvider: AIProviderType;

  constructor(defaultProvider: AIProviderType = "gemini") {
    this.providers = new Map();
    this.defaultProvider = defaultProvider;
    this.currentProvider = defaultProvider;

    // Inicializa providers disponíveis
    if (env.GOOGLE_API_KEY) {
      this.providers.set("gemini", new GeminiProvider(env.GOOGLE_API_KEY));
    }

    if (env.ANTHROPIC_API_KEY) {
      this.providers.set("claude", new ClaudeProvider(env.ANTHROPIC_API_KEY));
    }

    // Valida que pelo menos um provider está disponível
    if (this.providers.size === 0) {
      console.warn(
        "⚠️ Nenhum provider de IA configurado! Configure GOOGLE_API_KEY ou ANTHROPIC_API_KEY"
      );
    }

    // Valida que o provider default existe
    if (!this.providers.has(defaultProvider)) {
      const available = Array.from(this.providers.keys())[0];
      if (available) {
        console.warn(
          `⚠️ Provider '${defaultProvider}' não disponível. Usando '${available}' como default.`
        );
        this.defaultProvider = available;
        this.currentProvider = available;
      }
    }
  }

  /**
   * Chama o LLM com contexto da conversação e fallback automático
   */
  async callLLM(params: {
    message: string;
    history?: Message[];
    systemPrompt?: string;
  }): Promise<AIResponse> {
    const { systemPrompt, ...rest } = params;
    const prompt = systemPrompt || this.getDefaultSystemPrompt();

    // Tenta com o provider atual
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      return {
        message:
          "⚠️ Nenhum serviço de IA disponível. Configure GOOGLE_API_KEY ou ANTHROPIC_API_KEY no .env",
      };
    }

    try {
      const response = await provider.callLLM({
        ...rest,
        systemPrompt: prompt,
      });

      // Se sucesso, mantém o provider atual
      return response;
    } catch (error) {
      console.error(`Erro no provider ${this.currentProvider}:`, error);

      // Tenta fallback para outro provider
      const fallbackProvider = this.getFallbackProvider();
      if (fallbackProvider) {
        console.log(`Tentando fallback para ${fallbackProvider}...`);
        this.currentProvider = fallbackProvider;
        return this.callLLM({ ...rest, systemPrompt: prompt });
      }

      // Sem fallback disponível
      return {
        message:
          "⚠️ Todos os serviços de IA estão indisponíveis. Tente novamente mais tarde.",
      };
    }
  }

  /**
   * Retorna um provider alternativo disponível
   */
  private getFallbackProvider(): AIProviderType | null {
    const available = Array.from(this.providers.keys());
    const fallback = available.find((p) => p !== this.currentProvider);
    return fallback || null;
  }

  /**
   * Força o uso de um provider específico
   */
  setProvider(provider: AIProviderType): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider '${provider}' não está configurado`);
    }
    this.currentProvider = provider;
    console.log(`Provider alterado para: ${provider}`);
  }

  /**
   * Retorna o provider ativo
   */
  getCurrentProvider(): AIProviderType {
    return this.currentProvider;
  }

  /**
   * Lista providers disponíveis
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * System prompt padrão
   */
  private getDefaultSystemPrompt(): string {
    return `Você é um assistente pessoal que ajuda usuários a organizar conteúdo (filmes, vídeos, links, notas).

CAPACIDADES:
- Identificar e classificar conteúdo (filme, vídeo, link, nota)
- Entender contexto de mensagens anteriores
- Distinguir entre novas solicitações e refinamentos/complementos

COMPORTAMENTO COM MÚLTIPLAS MENSAGENS:
1. Se a nova mensagem se refere ao conteúdo anterior (ex: "o de 1999", "quero o primeiro", "com o brad pitt"):
   - Trate como REFINAMENTO do contexto anterior
   - Use o histórico para entender a solicitação completa
   - Exemplo: usuário disse "clube da luta" e depois "o de 1999" → buscar "Fight Club 1999"

2. Se a nova mensagem é independente (ex: novo filme, novo link):
   - Trate como NOVA SOLICITAÇÃO separada
   - Processe normalmente
   - Exemplo: usuário disse "clube da luta" e depois "matrix" → duas solicitações diferentes

3. Quando em dúvida, analise:
   - Presença de artigos definidos ("o", "a", "aquele")
   - Pronomes demonstrativos ("esse", "este", "aquele")
   - Números ordinais ("primeiro", "segundo")
   - Complementos de informação (ano, ator, diretor)

Seja conciso, prestativo e natural. Sempre considere o histórico recente.`;
  }
}

// Singleton com Gemini como default
export const llmService = new AIService("gemini");
export type { AIProvider, AIProviderType, AIResponse, Message } from "./types";
