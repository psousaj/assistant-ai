# Estrutura do Projeto

Organização de arquivos e pastas do Nexo AI.

````
nexo-ai/
├── src/
│ ├── index.ts # Entry point Elysia + Cloudflare Worker
│ │
│ ├── config/
│ │ ├── env.ts # Validação env vars (Zod)
│ │ ├── database.ts # Drizzle client (Supabase)
│ │ └── swagger.ts # Config OpenAPI/Scalar
│ │
│ ├── db/
│ │ ├── schema/
│ │ │ ├── users.ts
│ │ │ ├── items.ts
│ │ │ ├── conversations.ts
│ │ │ ├── messages.ts
│ │ │ └── index.ts # Export + Relations
│ │ ├── migrations/ # SQL migrations
│ │ └── client.ts # Drizzle instance
│ │
│ ├── routes/
│ │ ├── webhook/
│ │ │ ├── meta.ts # POST /webhook/meta
│ │ │ └── schema.ts # OpenAPI schemas
│ │ ├── items/
│ │ │ ├── index.ts # CRUD endpoints
│ │ │ │ # GET /items
│ │ │ │ # GET /items/:id
│ │ │ │ # POST /items
│ │ │ │ # PATCH /items/:id
│ │ │ │ # DELETE /items/:id
│ │ │ ├── search.ts # POST /items/search
│ │ │ ├── stats.ts # GET /items/stats
│ │ │ └── schema.ts
│ │ ├── auth/
│ │ │ └── index.ts # Supabase Auth routes
│ │ └── health.ts # GET /health
│ │
│ ├── services/
│ │ ├── ai/
│ │ │ ├── claude.ts # Cliente Claude API
│ │ │ │ # - sendMessage()
│ │ │ │ # - processWithTools()
│ │ │ └── tools.ts # Tool definitions
│
│ │ # - save_item
│ │ │ # - search_items
│ │ │ # - get_streaming_info
│ │ │ # - enrich_metadata
│ │ │
│ │ ├── mcp/
│ │ │ ├── server.ts # MCP Server impl
│ │ │ ├── resources.ts # MCP Resources
│ │ │ ├── tools.ts # MCP Tools
│ │ │ └── prompts.ts # MCP Prompts
│ │ │
│ │ ├── whatsapp/
│ │ │ ├── meta.ts # Meta API client
│ │ │ │ # - sendMessage()
│ │ │ │ # - sendReaction()
│ │ │ │ # - markAsRead()
│ │ │ └── message-handler.ts # Processa msgs recebidas
│ │ │
│ │ ├── enrichment/
│ │ │ ├── index.ts # Facade - detecta e enriquece
│ │ │ ├── tmdb.ts # TMDB API
│ │ │ │ # - searchMovie()
│ │ │ │ # - getMovieDetails()
│ │ │ │ # - getStreamingProviders()
│ │ │ ├── youtube.ts # YouTube Data API
│ │ │ │ # - getVideoDetails()
│ │ │ │ # - extractVideoId()
│ │ │ └── opengraph.ts # OpenGraph parser
│ │ │ # - fetchMetadata()
│ │ │ # - parseOGTags()
│ │ │
│ │ ├── conversation/
│ │ │ ├── manager.ts # Context management
│ │ │ │ # - getOrCreateConversation()
│ │ │ │ # - addMessage()
│ │ │ │ # - getHistory()
│ │ │ │ # - updateState()
│ │ │ └── state-machine.ts # State transitions
│ │ │ # idle → awaiting_confirmation
│ │ │ # → enriching → saving → idle
│ │ │
│ │ └── items/
│ │ ├── repository.ts # Data access layer (Drizzle)
│ │ │ # - create()
│ │ │ # - findById()
│ │ │ # - search()
│ │ │ # - update()
│ │ │ # - delete()
│ │ └── classifier.ts # Classifica tipo de item
│ │ # - detectType()
│ │ # - extractEntities()
│ │
│ ├── lib/
│ │ ├── logger.ts # Logger (console.log wrapper)
│ │ ├── errors.ts # Custom error classes
│ │ └── validators.ts # Zod schemas reutilizáveis
│ │
│ └── types/
│ ├── item.ts # Item types & metadata
│ ├── conversation.ts # Conversation types
│ ├── meta.ts # Meta API types
│ └── api.ts # External API types
│
├── docs/
│ ├── STACK.md              # Stack tecnológica
│ ├── ARQUITETURA.md        # Arquitetura do sistema
│ ├── SCHEMA.md             # Database schema
│ ├── METADA.md             # Tipos de metadados
│ ├── ENDPOINTS.md          # API REST documentation
│ ├── ESTRUTURA.md          # Este arquivo
│ ├── ENV.md                # Environment variables
│ ├── DEPLOYMENT.md         # Deploy guide
│ └── ROADMAP.md            # Roadmap e planejamento
│
├── drizzle/
│ ├── migrations/ # SQL gerados
│ └── meta/
│
├── .env.example
├── .env
├── .gitignore
├── wrangler.toml # Cloudflare Workers config
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── README.md

## Convenções

### Nomenclatura de Arquivos

- **Lowercase kebab-case**: `message-handler.ts`
- **Singular para schemas**: `user.ts`, `item.ts`
- **index.ts** para re-exports

### Nomenclatura de Funções

- **camelCase**: `getUserById()`, `sendMessage()`
- **Prefixos semânticos**:
  - `get` = leitura
  - `create/save` = escrita
  - `update` = modificação
  - `delete/remove` = remoção

### Importações

```typescript
// Ordem de imports
1. External libs (elysia, drizzle, etc)
2. Internal absolute (@/...)
3. Internal relative (../, ./)
4. Types (import type {...})
````

### Error Handling

```typescript
// Sempre usar try-catch em routes
try {
  // logic
} catch (error) {
  logger.error("Context:", error);
  throw new AppError("User message", 500, error);
}
```

## Cloudflare Workers Considerations

### Limitações

- **CPU time**: Max 50ms (free) / 30s (paid)
- **Memory**: 128MB
- **Request size**: 100MB
- **Response size**: Unlimited

### Otimizações

- Cache responses quando possível
- Use `waitUntil()` para operações assíncronas não-blocking
- Minimize cold starts (bundle size)

### Exemplo Worker Handler

```typescript
// src/index.ts
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";

const app = new Elysia()
  .use(swagger())
  .get("/health", () => ({ status: "ok" }));
// ... outras routes

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return app.handle(request);
  },
};
```
