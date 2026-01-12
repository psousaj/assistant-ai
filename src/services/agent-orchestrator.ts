/**
 * Orquestrador de Agente - Padrão Hugging Face Agents
 *
 * Arquitetura em camadas:
 * 1. Intent Classifier (determinístico) → decide ação
 * 2. State Machine → controla fluxo
 * 3. LLM (planner/writer) → escolhe tools e gera texto
 * 4. Tools (código) → executa ações
 *
 * LLM NUNCA:
 * - Gerencia estado
 * - Decide fluxo
 * - Executa lógica
 * - Controla loops
 * - É proativa
 *
 * LLM APENAS:
 * - Analisa
 * - Planeja
 * - Escolhe tools
 * - Redige respostas
 */

import { intentClassifier, type IntentResult, type UserIntent } from './intent-classifier';
import { conversationService } from './conversation-service';
import { llmService } from './ai';
import { executeTool, type ToolContext, type ToolOutput } from './tools';
import {
	CASUAL_GREETINGS,
	GENERIC_CONFIRMATION,
	CANCELLATION_PROMPT,
	NO_ITEMS_FOUND,
	SAVE_SUCCESS,
	GENERIC_ERROR,
	formatItemsList,
} from '@/config/prompts';
import type { ConversationState } from '@/types';

export interface AgentContext {
	userId: string;
	conversationId: string;
	externalId: string;
	message: string;
}

export interface AgentResponse {
	message: string;
	state: ConversationState;
	toolsUsed?: string[];
}

/**
 * Orquestrador principal do agente
 */
export class AgentOrchestrator {
	/**
	 * Processa mensagem do usuário
	 */
	async processMessage(context: AgentContext): Promise<AgentResponse> {
		console.log('🎯 [Agent] Processando mensagem:', context.message);

		// 1. CLASSIFICAR INTENÇÃO (determinístico)
		const intent = intentClassifier.classify(context.message);
		console.log(`🧠 [Agent] Intenção detectada: ${intent.intent} (${intent.confidence})`);

		// 2. BUSCAR ESTADO ATUAL
		const conversation = await conversationService.findOrCreateConversation(context.userId);
		console.log(`📊 [Agent] Estado atual: ${conversation.state}`);

		// 3. DECIDIR AÇÃO BASEADO EM INTENÇÃO + ESTADO
		const action = this.decideAction(intent, conversation.state);
		console.log(`⚡ [Agent] Ação decidida: ${action}`);

		// 4. EXECUTAR AÇÃO
		let response: AgentResponse;

		switch (action) {
			case 'handle_delete_all':
				response = await this.handleDeleteAll(context);
				break;

			case 'handle_delete_item':
				response = await this.handleDeleteItem(context, intent);
				break;

			case 'handle_search':
				response = await this.handleSearch(context, intent);
				break;

			case 'handle_save_previous':
				response = await this.handleSavePrevious(context, conversation);
				break;

			case 'handle_with_llm':
				response = await this.handleWithLLM(context, intent, conversation);
				break;

			case 'handle_confirmation':
				response = await this.handleConfirmation(context, conversation);
				break;

			case 'handle_denial':
				response = await this.handleDenial(context, conversation);
				break;

			case 'handle_casual':
				response = await this.handleCasual(context);
				break;

			default:
				response = {
					message: 'Não entendi. Pode reformular?',
					state: 'idle',
				};
		}

		// 5. ATUALIZAR ESTADO
		await conversationService.updateState(conversation.id, response.state, {
			lastIntent: intent.intent,
			lastAction: action,
		});

		// 6. SALVAR MENSAGENS
		await conversationService.addMessage(conversation.id, 'user', context.message);
		await conversationService.addMessage(conversation.id, 'assistant', response.message);

		console.log(`✅ [Agent] Resposta gerada: "${response.message.substring(0, 100)}..."`);
		return response;
	}

	/**
	 * Decide qual ação tomar baseado em intenção + estado
	 */
	private decideAction(intent: IntentResult, state: ConversationState): string {
		// Confirmação/Negação só importam se estamos aguardando
		if (state === 'awaiting_confirmation') {
			if (intent.action === 'confirm') return 'handle_confirmation';
			if (intent.action === 'deny') return 'handle_denial';
		}

		// AÇÕES DETERMINÍSTICAS (execução direta, sem LLM)
		switch (intent.action) {
			case 'delete_all':
				return 'handle_delete_all';
			case 'delete_item':
			case 'delete_selected':
				return 'handle_delete_item';
			case 'list_all':
			case 'search':
				return 'handle_search';
			case 'save_previous':
				return 'handle_save_previous';
			case 'greet':
			case 'thank':
				return 'handle_casual';
		}

		// Resto: delega para LLM
		return 'handle_with_llm';
	}

	/**
	 * Delega para LLM (planner/writer)
	 *
	 * LLM retorna JSON seguindo AgentLLMResponse schema.
	 * Runtime processa e decide o que fazer.
	 */
	private async handleWithLLM(context: AgentContext, intent: IntentResult, conversation: any): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Monta histórico (últimas 10 mensagens)
		const history = await conversationService.getHistory(context.conversationId, 10);
		const formattedHistory = history.map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content,
		}));

		// Chama LLM
		const llmResponse = await llmService.callLLM({
			message: context.message,
			history: formattedHistory,
		});

		// TODO: PROCESSAR AgentLLMResponse (JSON schema)
		// Por ora, mantém comportamento antigo até refatoração completa
		// Ver: docs/IMPLEMENTATION-CHECKLIST.md

		// Se LLM solicitou tools, executa
		const toolsUsed: string[] = [];
		if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
			console.log(`🔧 [Agent] LLM solicitou ${llmResponse.tool_calls.length} tools`);

			for (const toolCall of llmResponse.tool_calls) {
				const result = await executeTool(toolCall.function.name as any, toolContext, JSON.parse(toolCall.function.arguments));
				toolsUsed.push(toolCall.function.name);
				if (result.success && result.message) {
					// LLM já deve ter incluído isso na resposta
				}
			}
		}

		// Determina próximo estado
		let nextState: ConversationState = 'idle';

		// Se há múltiplos resultados, aguarda confirmação
		if (llmResponse.message.includes('Qual') || llmResponse.message.includes('qual')) {
			nextState = 'awaiting_confirmation';
		}

		return {
			message: llmResponse.message,
			state: nextState,
			toolsUsed,
		};
	}

	/**
	 * Trata confirmação do usuário
	 */
	private async handleConfirmation(context: AgentContext, conversation: any): Promise<AgentResponse> {
		// Busca contexto anterior
		const contextData = conversation.context || {};

		// Se há candidatos aguardando seleção
		if (contextData.candidates && Array.isArray(contextData.candidates)) {
			const selection = intentClassifier.classify(context.message).entities?.selection;

			if (selection && selection <= contextData.candidates.length) {
				const selected = contextData.candidates[selection - 1];

				// Salva o item selecionado
				const toolContext: ToolContext = {
					userId: context.userId,
					conversationId: context.conversationId,
				};

				// TODO: Determinar qual tool específica usar baseado no tipo
				const toolName = selected.type === 'movie' ? 'save_movie' : 'save_note';
				await executeTool(toolName as any, toolContext, {
					title: selected.title,
					...selected,
				});

				return {
					message: `✅ ${selected.title} salvo!`,
					state: 'idle',
					toolsUsed: [toolName],
				};
			}
		}

		// Confirmação genérica
		return {
			message: GENERIC_CONFIRMATION,
			state: 'idle',
		};
	}

	/**
	 * Trata negação do usuário
	 */
	private async handleDenial(context: AgentContext, conversation: any): Promise<AgentResponse> {
		return {
			message: CANCELLATION_PROMPT,
			state: 'idle',
		};
	}

	/**
	 * Salva mensagem anterior quando usuário diz "salva ai", "guarda isso"
	 */
	private async handleSavePrevious(context: AgentContext, conversation: any): Promise<AgentResponse> {
		// Busca últimas mensagens (exclui a atual que é o pedido para salvar)
		const history = await conversationService.getHistory(context.conversationId, 10);

		// Pega a penúltima mensagem do usuário (última antes de "salva ai")
		const userMessages = history.filter((m) => m.role === 'user');

		if (userMessages.length < 2) {
			return {
				message: 'Não tenho nenhuma mensagem anterior para salvar.',
				state: 'idle',
			};
		}

		// Pega a mensagem anterior (penúltima)
		const previousMessage = userMessages[userMessages.length - 2];
		const contentToSave = previousMessage.content;

		// Salva como nota
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		const result = await executeTool('save_memory', toolContext, {
			type: 'note',
			title: contentToSave.length > 100 ? contentToSave.substring(0, 97) + '...' : contentToSave,
			metadata: {
				fullContent: contentToSave,
				savedFrom: 'previous_message',
			},
		});

		if (result.success) {
			return {
				message: SAVE_SUCCESS('✅ Salvei!'),
				state: 'idle',
				toolsUsed: ['save_memory'],
			};
		} else {
			return {
				message: GENERIC_ERROR,
				state: 'idle',
			};
		}
	}

	/**
	 * Trata conversa casual (sem LLM)
	 */
	private async handleCasual(context: AgentContext): Promise<AgentResponse> {
		const msg = context.message.toLowerCase().trim();
		const response = CASUAL_GREETINGS[msg] || 'Oi! 👋';

		return {
			message: response,
			state: 'idle',
		};
	}

	/**
	 * Handler: Busca/Listagem (determinístico, sem LLM)
	 */
	private async handleSearch(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		const result = await executeTool('search_items', toolContext, {
			query: intent.entities?.query,
			limit: 10,
		});

		if (result.success && result.data) {
			const count = result.data.count;
			if (count === 0) {
				return {
					message: NO_ITEMS_FOUND,
					state: 'idle',
					toolsUsed: ['search_items'],
				};
			}

			const message = formatItemsList(result.data.items, count);

			return {
				message,
				state: 'idle',
				toolsUsed: ['search_items'],
			};
		}

		// Erro na busca
		return {
			message: 'Erro ao buscar itens. Tente novamente.',
			state: 'idle',
		};
	}

	/**
	 * Handler: Deletar TUDO (determinístico, sem LLM)
	 */
	private async handleDeleteAll(context: AgentContext): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Executar delete direto (ação irreversível)
		const result = await executeTool('delete_all_memories', toolContext, {});

		if (result.success) {
			const count = result.data?.deleted_count || 0;
			return {
				message: `✅ ${count} item(ns) deletado(s) com sucesso.`,
				state: 'idle',
				toolsUsed: ['delete_all_memories'],
			};
		}

		return {
			message: 'Erro ao deletar itens. Tente novamente.',
			state: 'idle',
		};
	}

	/**
	 * Handler: Deletar item específico (determinístico)
	 */
	private async handleDeleteItem(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		const toolContext: ToolContext = {
			userId: context.userId,
			conversationId: context.conversationId,
		};

		// Se tem selection (número), busca primeiro para pegar ID
		if (intent.entities?.selection) {
			// Buscar lista para pegar o item N
			const searchResult = await executeTool('search_items', toolContext, {
				limit: 20,
			});

			if (searchResult.success && searchResult.data) {
				const items = searchResult.data.items;
				const index = intent.entities.selection - 1;

				if (index >= 0 && index < items.length) {
					const itemToDelete = items[index];

					// Deletar o item
					const deleteResult = await executeTool('delete_memory', toolContext, {
						item_id: itemToDelete.id,
					});

					if (deleteResult.success) {
						return {
							message: `✅ "${itemToDelete.title}" deletado com sucesso.`,
							state: 'idle',
							toolsUsed: ['search_memory', 'delete_memory'],
						};
					}
				} else {
					return {
						message: `Item ${intent.entities.selection} não encontrado. Você tem ${items.length} item(ns) salvos.`,
						state: 'idle',
					};
				}
			}
		}

		// Se tem query, buscar e pedir confirmação
		if (intent.entities?.query) {
			return {
				message: `Quer deletar itens relacionados a "${intent.entities.query}"? Responda com "sim" ou "não".`,
				state: 'awaiting_confirmation',
			};
		}

		// Sem informação suficiente
		return {
			message: 'Qual item você quer deletar? Diga o número ou o nome.',
			state: 'idle',
		};
	}

	/**
	 * Executa ação direta (DEPRECATED - usar handleSearch)
	 */
	private async handleDirect(context: AgentContext, intent: IntentResult): Promise<AgentResponse> {
		return this.handleSearch(context, intent);
	}
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
