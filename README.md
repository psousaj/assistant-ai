# Nexo AI

Assistente pessoal via WhatsApp que organiza, categoriza e enriquece automaticamente conteúdo usando IA.

## O que faz?

Envie mensagens sobre filmes, vídeos, links ou notas pelo WhatsApp:

- Identifica o tipo de conteúdo automaticamente
- Enriquece com metadados (TMDB, YouTube, OpenGraph)
- Salva organizado no PostgreSQL com busca inteligente

## Quick Start

```bash
# Instalar
bun install

# Configurar environment
cp .env.example .env

# Database
bun run db:generate
bun run db:push

# Rodar
bun run dev
```

## Stack

- **Runtime**: Bun + Elysia
- **Deploy**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL + JSONB)
- **ORM**: Drizzle
- **WhatsApp**: Meta API oficial
- **AI**: Claude (Anthropic)
- **Enrichment**: TMDB, YouTube Data API, OpenGraph

Ver decisões técnicas em [docs/adr/](docs/adr/README.md)

## Arquitetura

### Diagrama de Fluxo

```
WhatsApp (Meta API)
    ↓
Webhook → Conversation Manager (State Machine)
              ↓
          AI Service (Claude) + Tools
              ↓
          Enrichment (TMDB/YouTube/OG)
              ↓
          PostgreSQL (Supabase)
```

### Camadas

**1. Adapters (REST/MCP)**

- Traduzem requisições externas
- `routes/webhook/meta.ts` - WhatsApp webhook
- `routes/items/` - CRUD REST
- MCP server (futuro)

**2. Services (Lógica de Negócio)**

- `conversation-service` - State machine de conversação
- `ai-service` - Interface com LLM (provider-agnostic)
- `enrichment-service` - TMDB, YouTube, OpenGraph
- `item-service` - CRUD de items
- `classifier-service` - Detecção de tipo de conteúdo

**3. Database (PostgreSQL + Supabase)**

- `users` - Usuários WhatsApp
- `items` - Conteúdo salvo (metadata JSONB)
- `conversations` - Estado de conversas
- `messages` - Histórico de mensagens

### State Machine

Estados da conversação:

```
idle → awaiting_confirmation → enriching → saving → idle
  ↓                               ↓
  └────────────── error ──────────┘
```

**Por quê?** Ver [ADR-004](docs/adr/004-state-machine.md)

### Princípios

- **Adapters são simples**: apenas traduzem requisições
- **Services são provider-agnostic**: podem trocar LLM/APIs sem quebrar
- **JSONB para flexibilidade**: metadados diferentes por tipo de item
- **State persistido**: conversação sobrevive a cold starts

Ver todos os ADRs em [docs/adr/](docs/adr/README.md)

## Database Schema

### `users`

```typescript
{
  id: uuid,
  phone_number: string,
  whatsapp_name: string,
  created_at: timestamp
}
```

### `items`

```typescript
{
  id: uuid,
  user_id: uuid,
  type: 'movie' | 'video' | 'link' | 'note',
  title: string,
  metadata: jsonb,  // Estrutura varia por tipo
  created_at: timestamp
}
```

**Metadata por tipo:**

**Movie:**

```typescript
{
  tmdb_id: number,
  year: number,
  genres: string[],
  rating: number,
  streaming: [{ provider: string, url: string }],
  poster_url: string
}
```

**Video:**

```typescript
{
  video_id: string,
  platform: 'youtube' | 'vimeo',
  channel_name: string,
  duration: number,
  views: number
}
```

**Link:**

```typescript
{
  url: string,
  og_title: string,
  og_description: string,
  og_image: string
}
```

**Note:**

```typescript
{
  category: string,
  related_topics: string[],
  priority: 'low' | 'medium' | 'high'
}
```

### `conversations`

```typescript
{
  id: uuid,
  user_id: uuid,
  state: 'idle' | 'awaiting_confirmation' | 'enriching' | 'saving' | 'error',
  context: jsonb,  // Dados temporários da conversa
  updated_at: timestamp
}
```

### `messages`

```typescript
{
  id: uuid,
  conversation_id: uuid,
  role: 'user' | 'assistant',
  content: string,
  created_at: timestamp
}
```

## Environment Variables

### Arquivo `.env`

```env
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres

# WhatsApp (Meta API)
META_WHATSAPP_TOKEN=EAAxxxx
META_WHATSAPP_PHONE_NUMBER_ID=123456789012345
META_VERIFY_TOKEN=seu_token_secreto
META_BUSINESS_ACCOUNT_ID=123456789012345

# AI (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-xxxx

# Enrichment APIs
TMDB_API_KEY=xxxx
YOUTUBE_API_KEY=AIzaSyXXXX

# Application
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info
```

### Obter Credenciais

| Serviço           | URL                                                                    | Instruções                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| **Supabase**      | [supabase.com](https://supabase.com)                                   | Settings > API > copiar keys        |
| **Meta WhatsApp** | [developers.facebook.com](https://developers.facebook.com)             | Criar App > WhatsApp > obter tokens |
| **Claude**        | [console.anthropic.com](https://console.anthropic.com)                 | API Keys > Create Key               |
| **TMDB**          | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Request API Key (grátis)            |
| **YouTube**       | [console.cloud.google.com](https://console.cloud.google.com)           | Enable YouTube Data API v3          |

## Deploy

### Cloudflare Workers

```bash
# 1. Configurar secrets
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put TMDB_API_KEY
wrangler secret put YOUTUBE_API_KEY

# 2. Deploy
wrangler deploy

# 3. Configurar webhook WhatsApp
# URL: https://seu-worker.workers.dev/webhook/meta
# Verify Token: (seu META_VERIFY_TOKEN)
```

### Troubleshooting

**Erro: "Module not found"**

- Verifique `wrangler.toml` compatibility flags
- Rode `bun install` novamente

**Timeout em produção**

- Cloudflare Workers: 50ms CPU (free) / 30s (paid)
- Use `waitUntil()` para operações async

**Database connection issues**

- Supabase pooler: `pgbouncer` mode para serverless
- Connection string deve usar port `6543`

## API Endpoints

### POST `/webhook/meta`

Webhook Meta WhatsApp

**Headers:**

```
X-Hub-Signature-256: sha256=...
```

**Body:**

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "5511999999999",
                "text": { "body": "clube da luta" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### GET `/items`

Lista items do usuário

**Query:**

- `type`: movie | video | link | note
- `limit`: número de resultados (default: 20)

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "movie",
      "title": "Fight Club",
      "metadata": { ... }
    }
  ]
}
```

### POST `/items/search`

Busca semântica

**Body:**

```json
{
  "query": "filmes de ficção científica",
  "limit": 10
}
```

### GET `/health`

Health check

## Exemplo de Fluxo

```
1. Usuário: "clube da luta"
   → Webhook recebe mensagem
   → conversation-service carrega estado (idle)

2. Bot classifica
   → classifier-service detecta: "movie"
   → enrichment-service busca TMDB
   → Retorna múltiplos resultados

3. Bot: "Encontrei 2 filmes:
         1. Fight Club (1999) - David Fincher ⭐ 8.8
         2. The Fight Club (2020)
         Qual você quer salvar?"
   → Estado muda para: awaiting_confirmation
   → context salva: { candidates: [...], awaiting_selection: true }

4. Usuário: "1"
   → conversation-service carrega context
   → AI confirma seleção
   → item-service.createItem()

5. Bot: "✅ Fight Club (1999)
         Netflix, Amazon Prime"
   → Estado volta para: idle
   → context limpo
```

## Roadmap

**MVP (v0.1)**

- ✅ WhatsApp webhook
- ✅ Classificação de conteúdo
- ✅ Enrichment TMDB/YouTube
- ✅ State machine de conversação
- ✅ Database setup

**v0.2**

- 🚧 MCP Server
- 🚧 Busca semântica
- 🚧 Notificações proativas

**v1.0**

- 📋 Dashboard web
- 📋 Recomendações IA
- 📋 Compartilhamento de listas

## Documentação Adicional

- **[docs/adr/](docs/adr/README.md)** - Architecture Decision Records
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - Guia para AI agents

## Licença

MIT
