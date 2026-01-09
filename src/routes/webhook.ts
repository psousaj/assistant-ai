import { Elysia, t } from "elysia";
import { userService } from "@/services/user-service";
import { conversationService } from "@/services/conversation-service";
import { classifierService } from "@/services/classifier-service";
import { enrichmentService } from "@/services/enrichment";
import { itemService } from "@/services/item-service";
import { llmService } from "@/services/ai";
import { env } from "@/config/env";
import {
  whatsappAdapter,
  telegramAdapter,
  type MessagingProvider,
  type IncomingMessage,
} from "@/adapters/messaging";

/**
 * Processa mensagem de qualquer provider (provider-agnostic)
 */
async function processMessage(
  incomingMsg: IncomingMessage,
  provider: MessagingProvider
) {
  const messageText = incomingMsg.text;
  let responseText = "";

  try {
    // 1. Busca ou cria usuário (unificação cross-provider)
    const { user } = await userService.findOrCreateUserByAccount(
      incomingMsg.externalId,
      incomingMsg.provider,
      incomingMsg.senderName,
      incomingMsg.phoneNumber
    );

    // 2. Busca ou cria conversação
    const conversation = await conversationService.findOrCreateConversation(
      user.id
    );

    // 3. Salva mensagem do usuário
    await conversationService.addMessage(conversation.id, "user", messageText);

    // 4. Verifica contexto recente (últimos 5 minutos)
    const recentMessages = await conversationService.getRecentMessages(
      conversation.id,
      5
    );
    const hasRecentContext = recentMessages.length > 1; // Mais de 1 mensagem = tem contexto

    // 5. Se está aguardando confirmação de item em batch, processa
    if (conversation.state === "awaiting_batch_item") {
      const context = conversation.context as any;
      const selection = parseInt(messageText.trim());

      if (
        !isNaN(selection) &&
        context.batch_current_candidates &&
        context.batch_current_candidates[selection - 1]
      ) {
        const selected = context.batch_current_candidates[selection - 1];
        const currentItem = context.batch_queue[context.batch_current_index];

        // Salva o filme confirmado
        if (currentItem.type === "movie") {
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: selected.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: selected.title,
            metadata: metadata || undefined,
          });

          // Marca item como confirmado
          context.batch_queue[context.batch_current_index].status = "confirmed";
          context.batch_confirmed_items = context.batch_confirmed_items || [];
          context.batch_confirmed_items.push({
            title: selected.title,
            year: selected.release_date?.split("-")[0],
          });

          responseText = `✅ ${selected.title} (${
            selected.release_date?.split("-")[0]
          }) salvo!\n\n`;
        }

        // Avança para o próximo item da fila
        context.batch_current_index++;

        // Verifica se ainda há itens pendentes
        const nextPendingIndex = context.batch_queue.findIndex(
          (item: any, idx: number) =>
            idx >= context.batch_current_index && item.status === "pending"
        );

        if (nextPendingIndex !== -1) {
          // Processa próximo item
          const nextItem = context.batch_queue[nextPendingIndex];
          context.batch_current_index = nextPendingIndex;
          nextItem.status = "processing";

          if (nextItem.type === "movie") {
            const results = await enrichmentService.searchMovies(
              nextItem.query
            );

            if (results.length === 1) {
              // Match único, salva direto e continua
              const movie = results[0];
              const metadata = await enrichmentService.enrich("movie", {
                tmdbId: movie.id,
              });

              await itemService.createItem({
                userId: user.id,
                type: "movie",
                title: movie.title,
                metadata: metadata || undefined,
              });

              nextItem.status = "confirmed";
              context.batch_confirmed_items.push({
                title: movie.title,
                year: movie.release_date?.split("-")[0],
              });

              responseText += `✅ ${movie.title} (${
                movie.release_date?.split("-")[0]
              }) salvo!\n\n`;

              // Continua processando recursivamente
              context.batch_current_index++;
              // TODO: processar próximos itens em loop
            } else if (results.length > 1) {
              // Múltiplos resultados, pede confirmação
              context.batch_current_candidates = results.slice(0, 3);

              const remaining = context.batch_queue.filter(
                (item: any) => item.status === "pending"
              ).length;
              const progress = `[${context.batch_current_index + 1}/${
                context.batch_queue.length
              }]`;

              const options = results
                .slice(0, 3)
                .map(
                  (m, i) =>
                    `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
                )
                .join("\n");

              responseText += `${progress} **${nextItem.query}**\n\nEncontrei:\n${options}\n\nQual você quer? (Digite o número)`;
              responseText +=
                remaining > 1
                  ? `\n\n📋 Ainda faltam ${remaining - 1} filme(s)`
                  : "";

              await conversationService.updateState(
                conversation.id,
                "awaiting_batch_item",
                context
              );
              await conversationService.addMessage(
                conversation.id,
                "assistant",
                responseText
              );
              await provider.sendMessage(incomingMsg.externalId, responseText);
              return;
            }
          }
        } else {
          // Terminou a fila!
          const totalConfirmed = context.batch_confirmed_items?.length || 0;
          responseText += `\n🎉 Pronto! ${totalConfirmed} filme(s) salvos:\n`;
          context.batch_confirmed_items?.forEach((item: any) => {
            responseText += `• ${item.title} (${item.year})\n`;
          });

          await conversationService.updateState(conversation.id, "idle", {});
        }

        await conversationService.addMessage(
          conversation.id,
          "assistant",
          responseText
        );
        await provider.sendMessage(incomingMsg.externalId, responseText);
        return;
      } else {
        const currentItem = context.batch_queue[context.batch_current_index];
        responseText = `Por favor, escolha uma das opções para "${currentItem.query}" (1, 2 ou 3).`;
        await conversationService.addMessage(
          conversation.id,
          "assistant",
          responseText
        );
        await provider.sendMessage(incomingMsg.externalId, responseText);
        return;
      }
    }

    // 5b. Se está aguardando confirmação simples, processa resposta
    if (conversation.state === "awaiting_confirmation") {
      const context = conversation.context as any;
      const selection = parseInt(messageText.trim());

      if (
        !isNaN(selection) &&
        context.candidates &&
        context.candidates[selection - 1]
      ) {
        const selected = context.candidates[selection - 1];

        if (context.detected_type === "movie") {
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: selected.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: selected.title,
            metadata: metadata || undefined,
          });

          responseText = `✅ Salvo: ${selected.title} (${
            selected.release_date?.split("-")[0]
          })`;

          // Reseta estado
          await conversationService.updateState(conversation.id, "idle", {});
        }
      } else {
        responseText =
          "Por favor, digite o número da opção que deseja (1, 2 ou 3).";
      }

      // Salva e envia resposta
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);
      return;
    }

    // 6. Classifica tipo de conteúdo
    let detectedType = classifierService.detectType(messageText);
    let processedMessage = messageText;

    // 6.1 DETECTA MÚLTIPLOS ITENS (lista)
    const multipleItems = classifierService.detectMultipleItems(messageText);

    if (multipleItems && multipleItems.length >= 2) {
      // Detectou lista! Inicia processamento em batch
      const batchQueue = multipleItems.map((item) => ({
        query: item,
        type: classifierService.detectType(item) || "movie",
        status: "pending" as const,
      }));

      responseText = `📋 Detectei ${multipleItems.length} itens! Vamos processar:\n`;
      multipleItems.forEach((item, i) => {
        responseText += `${i + 1}. ${item}\n`;
      });
      responseText += `\n⏳ Buscando informações...`;

      // Envia mensagem inicial
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);

      // Inicia processamento do primeiro item
      const firstItem = batchQueue[0];
      firstItem.status = "processing";

      if (firstItem.type === "movie") {
        const results = await enrichmentService.searchMovies(firstItem.query);

        if (results.length === 1) {
          // Match único, salva direto
          const movie = results[0];
          const metadata = await enrichmentService.enrich("movie", {
            tmdbId: movie.id,
          });

          await itemService.createItem({
            userId: user.id,
            type: "movie",
            title: movie.title,
            metadata: metadata || undefined,
          });

          firstItem.status = "confirmed";
          responseText = `✅ [1/${batchQueue.length}] ${movie.title} (${
            movie.release_date?.split("-")[0]
          }) salvo!\n\n`;

          // TODO: Continuar processando próximos itens
          // Por enquanto, continua no próximo ciclo de mensagem
        } else if (results.length > 1) {
          // Múltiplos resultados, pede confirmação
          await conversationService.updateState(
            conversation.id,
            "awaiting_batch_item",
            {
              batch_queue: batchQueue,
              batch_current_index: 0,
              batch_current_candidates: results.slice(0, 3),
              batch_confirmed_items: [],
            }
          );

          const options = results
            .slice(0, 3)
            .map(
              (m, i) =>
                `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
            )
            .join("\n");

          responseText = `[1/${batchQueue.length}] **${
            firstItem.query
          }**\n\nEncontrei:\n${options}\n\nQual você quer? (Digite o número)\n\n📋 Depois confirmo os outros ${
            batchQueue.length - 1
          } filmes`;

          await conversationService.addMessage(
            conversation.id,
            "assistant",
            responseText
          );
          await provider.sendMessage(incomingMsg.externalId, responseText);
          return;
        } else {
          // Não encontrou
          firstItem.status = "skipped";
          responseText = `❌ [1/${batchQueue.length}] Não encontrei "${firstItem.query}"\n\n`;
        }
      }

      // Se chegou aqui sem retornar, continua processando próximos
      // (implementação simplificada - ideal seria loop recursivo)
      await conversationService.addMessage(
        conversation.id,
        "assistant",
        responseText
      );
      await provider.sendMessage(incomingMsg.externalId, responseText);
      return;
    }

    // 7. Se tem contexto recente E não detectou tipo claro, usa IA para analisar
    if (
      hasRecentContext &&
      detectedType === "note" &&
      !classifierService.extractUrl(messageText)
    ) {
      try {
        const history = await conversationService.getHistory(
          conversation.id,
          10
        );
        const contextAnalysis = await llmService.callLLM({
          message: `ANÁLISE DE CONTEXTO:

Histórico recente:
${history
  .slice(-6)
  .map((m) => `${m.role === "user" ? "Usuário" : "Bot"}: ${m.content}`)
  .join("\n")}

Nova mensagem: "${messageText}"

PERGUNTA: Esta nova mensagem é:
A) Um REFINAMENTO/COMPLEMENTO da mensagem anterior (adiciona contexto, especifica detalhes)
B) Uma NOVA SOLICITAÇÃO independente

Responda apenas: "REFINAMENTO" ou "NOVA_SOLICITACAO"

Se for refinamento, forneça também a consulta combinada no formato:
RESULTADO: [consulta completa]`,
          history: [],
          systemPrompt:
            "Você analisa contexto de conversas. Responda de forma direta e objetiva.",
        });

        const isRefinement = contextAnalysis.message
          .toUpperCase()
          .includes("REFINAMENTO");

        if (isRefinement) {
          // Extrai consulta combinada se disponível
          const resultMatch =
            contextAnalysis.message.match(/RESULTADO:\s*(.+)/i);
          if (resultMatch) {
            processedMessage = resultMatch[1].trim();
            // Reclassifica com o contexto combinado
            detectedType = classifierService.detectType(processedMessage);
          }
        }
      } catch (error) {
        console.error("Erro ao analisar contexto:", error);
        // Se falhar análise, continua com detecção normal
      }
    }

    // 8. Processa baseado no tipo detectado (agora com contexto)

    if (detectedType === "movie") {
      const query = classifierService.extractQuery(processedMessage, "movie");
      const results = await enrichmentService.searchMovies(query);

      if (results.length === 0) {
        responseText = `Não encontrei nenhum filme com "${query}". Pode tentar com outro nome?`;
      } else if (results.length === 1) {
        // Salva direto
        const movie = results[0];
        const metadata = await enrichmentService.enrich("movie", {
          tmdbId: movie.id,
        });

        await itemService.createItem({
          userId: user.id,
          type: "movie",
          title: movie.title,
          metadata: metadata || undefined,
        });

        responseText = `✅ Salvo: ${movie.title} (${
          movie.release_date?.split("-")[0]
        })`;
      } else {
        // Múltiplos resultados - pede confirmação
        await conversationService.updateState(
          conversation.id,
          "awaiting_confirmation",
          {
            candidates: results.slice(0, 3),
            detected_type: "movie",
          }
        );

        const options = results
          .slice(0, 3)
          .map(
            (m, i) => `${i + 1}. ${m.title} (${m.release_date?.split("-")[0]})`
          )
          .join("\n");

        responseText = `Encontrei vários filmes:\n\n${options}\n\nQual você quer salvar? (Digite o número)`;
      }
    } else if (detectedType === "video") {
      const url = classifierService.extractUrl(processedMessage);
      if (url) {
        const metadata = await enrichmentService.enrich("video", { url });

        await itemService.createItem({
          userId: user.id,
          type: "video",
          title:
            (metadata && "channel_name" in metadata
              ? metadata.channel_name
              : null) || "Vídeo",
          metadata: metadata || undefined,
        });

        responseText = `✅ Vídeo salvo!`;
      }
    } else if (detectedType === "link") {
      const url = classifierService.extractUrl(processedMessage);
      if (url) {
        const metadata = await enrichmentService.enrich("link", { url });

        await itemService.createItem({
          userId: user.id,
          type: "link",
          title:
            (metadata && "og_title" in metadata ? metadata.og_title : null) ||
            url,
          metadata: metadata || undefined,
        });

        responseText = `✅ Link salvo!`;
      }
    } else {
      // Nota ou mensagem genérica - usa AI
      try {
        const history = await conversationService.getHistory(conversation.id);
        const aiResponse = await llmService.callLLM({
          message: messageText,
          history,
        });

        // Verifica se a IA retornou uma resposta válida
        if (
          !aiResponse ||
          !aiResponse.message ||
          aiResponse.message.trim() === ""
        ) {
          responseText =
            "😅 Opa, fiquei sem resposta aqui meu brother! Tenta de novo ou me manda um filme, vídeo ou link que eu organizo pra você!";
        } else {
          responseText = aiResponse.message;
        }
      } catch (error) {
        console.error("Erro ao chamar AI:", error);
        responseText =
          "😅 Eita, dei um bug aqui meu brother! Mas não se preocupa, tenta de novo ou me manda algum conteúdo tipo:\n\n🎬 Nome de um filme\n🎥 Link do YouTube\n🔗 Qualquer link interessante";
      }
    }

    // 9. Salva resposta do bot
    await conversationService.addMessage(
      conversation.id,
      "assistant",
      responseText
    );
  } catch (error) {
    // Erro crítico durante processamento - responde com mensagem genérica
    console.error("Erro crítico ao processar mensagem:", error);
    responseText =
      "😅 Opa, algo deu errado aqui meu brother! Mas já estou de volta. Me manda aí:\n\n🎬 Um filme pra salvar\n🎥 Vídeo do YouTube\n🔗 Link interessante\n📝 Ou qualquer coisa que queira organizar!";
  }

  // 10. Envia resposta via provider (sempre envia, mesmo com erro)
  try {
    await provider.sendMessage(incomingMsg.externalId, responseText);

    // WhatsApp-specific: mark as read
    if (provider.getProviderName() === "whatsapp" && "markAsRead" in provider) {
      await (provider as any).markAsRead(incomingMsg.messageId);
    }
  } catch (error: any) {
    console.error(
      `Erro ao enviar mensagem via ${provider.getProviderName()}:`,
      error
    );
    // WhatsApp dev mode: números na lista permitida
    if (error.message?.includes("131030")) {
      console.warn(
        `⚠️  Número ${incomingMsg.externalId} não está na lista permitida (dev mode)`
      );
      console.warn(
        "Adicione em: https://developers.facebook.com/apps > WhatsApp > Configuration"
      );
    }
    // Não falha o webhook, apenas loga o erro
  }
}

export const webhookRouter = new Elysia({ prefix: "/webhook" })
  /**
   * POST /webhook/telegram - Recebe mensagens do Telegram (PADRÃO)
   */
  .post(
    "/telegram",
    async ({ body, request, set }) => {
      try {
        // Verifica autenticidade
        if (!telegramAdapter.verifyWebhook(request)) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        // Parse mensagem
        const incomingMsg = telegramAdapter.parseIncomingMessage(body);

        if (incomingMsg) {
          await processMessage(incomingMsg, telegramAdapter);
        }

        return { ok: true }; // Telegram espera "ok: true"
      } catch (error) {
        console.error("Erro no webhook Telegram:", error);
        set.status = 500;
        return { error: "Internal error" };
      }
    },
    {
      body: t.Any(),
      response: {
        200: t.Object({
          ok: t.Boolean(),
        }),
        403: t.Object({
          error: t.String(),
        }),
        500: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        tags: ["Webhook"],
        summary: "Recebe mensagens do Telegram (padrão)",
        description:
          "Webhook que recebe e processa mensagens do Telegram Bot API",
      },
    }
  )

  /**
   * POST /webhook/whatsapp - Recebe mensagens do WhatsApp
   */
  .post(
    "/whatsapp",
    async ({ body, request, set }) => {
      try {
        // Verifica autenticidade
        if (!whatsappAdapter.verifyWebhook(request)) {
          set.status = 403;
          return { error: "Forbidden" };
        }

        // Parse mensagem
        const incomingMsg = whatsappAdapter.parseIncomingMessage(body);

        if (incomingMsg) {
          await processMessage(incomingMsg, whatsappAdapter);
        }

        return { success: true };
      } catch (error) {
        console.error("Erro no webhook WhatsApp:", error);
        set.status = 500;
        return { error: "Internal error" };
      }
    },
    {
      body: t.Any(),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
        403: t.Object({
          error: t.String(),
        }),
        500: t.Object({
          error: t.String(),
        }),
      },
      detail: {
        tags: ["Webhook"],
        summary: "Recebe mensagens do WhatsApp",
        description:
          "Webhook que recebe e processa mensagens do WhatsApp Business API",
      },
    }
  )

  /**
   * GET /webhook/whatsapp - Verificação do webhook WhatsApp
   */
  .get(
    "/whatsapp",
    ({ query }) => {
      if (
        query["hub.mode"] === "subscribe" &&
        query["hub.verify_token"] === env.META_VERIFY_TOKEN
      ) {
        return new Response(query["hub.challenge"]);
      }

      return new Response("Forbidden", { status: 403 });
    },
    {
      query: t.Object({
        "hub.mode": t.Literal("subscribe"),
        "hub.verify_token": t.String(),
        "hub.challenge": t.String(),
      }),
      detail: {
        tags: ["Webhook"],
        summary: "Verificação do webhook WhatsApp",
        description: "Endpoint usado pelo Meta para verificar o webhook",
      },
    }
  );
