# Stack Tecnológica

Tecnologias utilizadas no Nexo AI.

## Runtime & Framework

- **Runtime**: Bun
- **Framework**: Elysia
- **Deployment**: Cloudflare Workers

## Database & Auth

- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Auth**: Supabase Auth

## APIs Externas

- **WhatsApp**: Meta WhatsApp Business API (oficial)
- **AI**: Claude API (Anthropic) + MCP Server
- **Enrichment**:
  - TMDB (filmes/séries)
  - YouTube Data API
  - OpenGraph (links)

## Ferramentas

- **Validação**: Zod
- **Logging**: Cloudflare Workers Analytics
- **Environment**: Cloudflare Workers Environment Variables

## Decisões Técnicas

### Por que Cloudflare Workers?

- Execução edge (baixa latência)
- Custo-benefício (100k requests grátis)
- Deploy simplificado

### Por que Supabase?

- PostgreSQL com JSONB nativo
- Auth integrado
- Row Level Security
- Free tier generoso

### Por que Elysia?

- Performance com Bun
- Type-safety end-to-end
- OpenAPI nativo
- Lightweight

### Por que Meta WhatsApp API?

- Oficial e estável
- SLA garantido
- Webhooks confiáveis
