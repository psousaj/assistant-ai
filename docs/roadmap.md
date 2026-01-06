# Roadmap - Senka

Planejamento de implementação do projeto em fases.

---

## Phase 1: Foundation ⚡ (Semana 1)

**Objetivo:** Setup básico funcional

### Tasks

- [ ] **1.1 Setup Inicial**

  - [ ] Criar projeto Bun + Elysia
  - [ ] Configurar TypeScript + tsconfig
  - [ ] Setup Drizzle ORM
  - [ ] Criar `wrangler.toml`
  - [ ] Configurar `.env.example`

- [ ] **1.2 Database Setup**

  - [ ] Criar conta Supabase
  - [ ] Definir schemas Drizzle (users, items, conversations, messages)
  - [ ] Gerar migrations
  - [ ] Aplicar migrations no Supabase
  - [ ] Testar conexão local

- [ ] **1.3 Basic API**

  - [ ] Endpoint `GET /health`
  - [ ] Logger setup (console wrapper)
  - [ ] Error handling middleware
  - [ ] Env validation (Zod)

- [ ] **1.4 Deploy Teste**
  - [ ] Deploy inicial Cloudflare Workers
  - [ ] Configurar secrets
  - [ ] Testar health endpoint em produção

**Entregável:** API deployada respondendo `/health`

---

## Phase 2: WhatsApp Integration 📱 (Semana 1-2)

**Objetivo:** Receber e responder mensagens WhatsApp

### Tasks

- [ ] **2.1 Meta API Client**

  - [ ] Service `whatsapp/meta.ts`
  - [ ] Função `sendMessage()`
  - [ ] Função `sendReaction()`
  - [ ] Função `markAsRead()`
  - [ ] Tratamento de erros Meta API

- [ ] **2.2 Webhook**

  - [ ] Route `POST /webhook/meta`
  - [ ] Validação signature (X-Hub-Signature-256)
  - [ ] Parsing payload Meta
  - [ ] `GET /webhook/meta` (verification)

- [ ] **2.3 Message Handler**

  - [ ] Service `message-handler.ts`
  - [ ] Extrair texto da mensagem
  - [ ] Responder "Olá! Recebi sua mensagem: {texto}"
  - [ ] Salvar mensagem no DB (table messages)

- [ ] **2.4 Conversation Manager**

  - [ ] Service `conversation/manager.ts`
  - [ ] `getOrCreateConversation()`
  - [ ] `addMessage()`
  - [ ] `getHistory()`

- [ ] **2.5 Testes Integração**
  - [ ] Enviar mensagem via WhatsApp
  - [ ] Verificar resposta automática
  - [ ] Verificar mensagem salva no DB

**Entregável:** Bot responde mensagens simples no WhatsApp

---

## Phase 3: Claude AI Integration 🤖 (Semana 2)

**Objetivo:** Processar mensagens com Claude e tools

### Tasks

- [ ] **3.1 Claude Client**

  - [ ] Service `ai/claude.ts`
  - [ ] Função `sendMessage()`
  - [ ] Função `processWithTools()`
  - [ ] Tratamento streaming responses

- [ ] **3.2 Tool Definitions**
  - [ ] File `ai/tools.ts`
  - [ ] Tool: `save_item`
  - [ ] Tool: `search_items`
  - [ ] Tool: `get_item
_details`

Tool: enrich_metadata
3.3 Tool Execution

Executar tool calls do Claude
Retornar resultados ao Claude
Loop até Claude ter resposta final

3.4 Integração Message Handler

Enviar mensagem usuário + histórico pra Claude
Processar tools se necessário
Enviar resposta Claude pro WhatsApp

3.5 State Machine

Service conversation/state-machine.ts
Estados: idle, awaiting_confirmation, enriching, saving
Transições entre estados
Salvar estado no DB (conversations.state)

Entregável: Claude responde inteligentemente e usa tools

Phase 4: Enrichment Services 🎬 (Semana 2-3)
Objetivo: Enriquecer items com metadados externos
Tasks

4.1 TMDB Integration

Service enrichment/tmdb.ts
searchMovie(query) → resultados
getMovieDetails(tmdb_id) → metadata completo
getStreamingProviders(tmdb_id, region='BR')
Tratamento rate limit (40/10s)
Cache responses (opcional)

4.2 YouTube Integration

Service enrichment/youtube.ts
extractVideoId(url | text) → video_id
getVideoDetails(video_id) → metadata
Tratamento quota (10k units/day)

4.3 OpenGraph Parser

Service enrichment/opengraph.ts
fetchMetadata(url) → fetch HTML
parseOGTags(html) → structured data
Fallback para meta tags normais

4.4 Enrichment Facade

Service enrichment/index.ts
enrichItem(type, data) → detecta tipo e chama serviço correto
Agregação de múltiplas sources se necessário

4.5 Classifier

Service items/classifier.ts
detectType(text) → infere tipo (movie, link, note, etc)
extractEntities(text, type) → extrai título, ano, etc
Usar Claude se ambíguo

Entregável: Items salvos com metadados ricos

Phase 5: Items CRUD API 📝 (Semana 3)
Objetivo: API REST completa para gerenciar items
Tasks

5.1 Repository Pattern

Service items/repository.ts
create(item) → INSERT
findById(id, userId) → SELECT
search(filters, userId) → SELECT com WHERE
update(id, data, userId) → UPDATE
delete(id, userId) → DELETE

5.2 REST Endpoints

GET /items (lista com filtros)
GET /items/:id (detalhes)
POST /items (criar manual)
PATCH /items/:id (atualizar)
DELETE /items/:id (deletar)

5.3 Advanced Search

POST /items/search (query complexa)
Full-text search (PostgreSQL tsvector)
Filtros: type, tags, status, yearRange, hasStreaming
Ordenação por metadata (JSONB)

5.4 Stats Endpoint

GET /items/stats
Total items
Breakdown por type/status
Top tags
Recent activity

5.5 Validations & Schemas

Zod schemas para cada endpoint
OpenAPI documentation
Error responses padronizados

Entregável: API REST completa e documentada

Phase 6: MCP Server 🔌 (Semana 3-4)
Objetivo: Expor MCP protocol para Claude Desktop/CLI
Tasks

6.1 MCP Server Setup

Service mcp/server.ts
Implementar MCP protocol spec
Registrar no Elysia

6.2 MCP Resources

items://user/{userId} → lista items
items://user/{userId}/type/{type} → filtrado
Read-only access

6.3 MCP Tools

Tool: save_item
Tool: search_items
Tool: update_item_status
Tool: get_streaming_availability

6.4 MCP Prompts

Prompt: categorize_item → template classificação
Prompt: enrich_metadata → template enrichment
Prompt: recommend_similar → sugestões

6.5 Testing

Testar com Claude Desktop
Testar com MCP CLI
Documentar setup MCP

Entregável: MCP server funcional

Phase 7: Auth & Multi-User 🔐 (Semana 4)
Objetivo: Suporte multi-usuário com autenticação
Tasks

7.1 Supabase Auth Setup

Habilitar Email/Password auth
Configurar email templates
Setup RLS (Row Level Security)

7.2 Auth Endpoints

POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/reset-password

7.3 Auth Middleware

Verificar JWT em todas as rotas protegidas
Extrair userId do token
Injetar no context da request

7.4 User Management

Vincular WhatsApp number ao user ID
Permitir múltiplos números por user
Settings/preferences por user

7.5 Permission Checks

User só acessa próprios items
User só acessa próprias conversas
Admin role (futuro)

Entregável: Sistema multi-usuário seguro

Phase 8: Polish & Improvements 💎 (Semana 4-5)
Objetivo: Refinamentos e features auxiliares
Tasks

8.1 Error Handling

Custom error classes
Error codes padronizados
Logs estruturados
Sentry integration (opcional)

8.2 Rate Limiting

Per-endpoint limits
Per-user limits
Cloudflare rate limiting rules

8.3 Caching

Cache TMDB responses (Cloudflare KV)
Cache YouTube responses
Cache OpenGraph (1 hora)

8.4 Bulk Operations

POST /items/bulk (criar múltiplos)
PATCH /items/bulk (update múltiplos)
DELETE /items/bulk (deletar múltiplos)

8.5 Export/Import

GET /items/export (JSON/CSV)
POST /items/import (JSON/CSV)
Backup completo do usuário

8.6 Webhooks Outgoing

Notificar external systems em events
POST /webhooks (register)
Signature validation

8.7 Testing

Unit tests (services)
Integration tests (routes + DB)
E2E tests (WhatsApp flow completo)
CI/CD setup (GitHub Actions)

Entregável: Sistema robusto e testado

Phase 9: Advanced Features 🚀 (Futuro)
Objetivo: Features avançadas pós-MVP
Future Tasks

9.1 Smart Recommendations

ML model ou Claude para recomendar items similares
"Baseado no que você salvou..."

9.2 Reminders & Notifications

Cron jobs (Cloudflare Workers Cron)
Enviar lembretes via WhatsApp
"Você salvou X há 1 semana, já assistiu?"

9.3 Web Dashboard

Frontend React/Next.js
Visualizar/gerenciar items
Analytics e gráficos

9.4 Voice Messages

Receber áudios WhatsApp
Transcrever com Whisper API
Processar como texto

9.5 Image Recognition

Receber imagens (cartazes, screenshots)
OCR + Claude Vision
Identificar filme/jogo/livro

9.6 More Enrichment Sources

Spotify (música)
Goodreads (livros)
Steam (jogos)
Trakt.tv (tracking filmes/séries)

9.7 Collaborative Lists

Compartilhar listas com amigos
Permissões (view, edit)
Comments nos items

9.8 Calendar Integration

Sync reminders com Google Calendar
iCal export

9.9 Mobile App

React Native app
Notificações push
Offline support

Milestones
MilestoneData EstimadaEntregávelM1: Hello WorldSemana 1API + WhatsApp respondeM2: MVP CoreSemana 3Claude + Enrichment + CRUDM3: Production ReadySemana 5Auth + Tests + DeployM4: Advanced FeaturesSemana 8+Recommendations + Dashboard

Métricas de Sucesso
MVP (M2)

10 usuários beta testando
100+ items salvos
90% das mensagens processadas corretamente
< 5s tempo de resposta médio

Production (M3)

100 usuários ativos
99.9% uptime
< 2s tempo de resposta médio
0 critical bugs

Scale (M4)

1000+ usuários
10k+ items salvos
Custo < $200/mês
NPS > 50

Priorização
Must Have (MVP)

WhatsApp integration
Claude AI + tools
Enrichment (TMDB, YouTube, OpenGraph)
Items CRUD
Basic search

Should Have (v1.0)

Auth multi-user
Advanced search
Stats/analytics
Export/import

Nice to Have (v2.0+)

MCP server
Recommendations
Voice messages
Web dashboard
Image recognition

Won't Have (Now)

Mobile app nativo
Collaborative features
Calendar sync
Offline support

Riscos e Mitigações
RiscoImpactoProbabilidadeMitigaçãoMeta API instávelAltoMédioRetry logic, queueClaude API caroMédioAltoCache, otimizar promptsRate limits excedidosMédioMédioCaching, user educationDB overloadAltoBaixoIndexes, connection poolingSpam/abuseMédioMédioRate limiting per user

Dependencies & Blockers

Supabase setup → Bloqueia Phase 1-2
Meta WhatsApp approval → Bloqueia Phase 2
Claude API access → Bloqueia Phase 3
TMDB/YouTube keys → Bloqueia Phase 4

Team (se aplicável)

Backend: 1 dev (você)
Frontend: (futuro)
Design: (futuro)
QA: Manual testing inicial

Release Strategy
Beta (Private)

10-20 usuários selecionados
Feedback direto via WhatsApp group
Iteração rápida (deploy diário)

Public Launch

Blog post + Product Hunt
Twitter announcement
Demo video

Ongoing

Weekly updates
Monthly feature releases
Quarterly roadmap review

Let's build! 🚀
