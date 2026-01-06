# Environment Variables

## Arquivo `.env`

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
WEBHOOK_SECRET=seu_secret
```

## Configuração em Produção

```bash
# Cloudflare Workers - via Wrangler CLI
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put TMDB_API_KEY
wrangler secret put YOUTUBE_API_KEY
```

## Obter Credenciais

| Serviço           | URL                                                                    | Instruções                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| **Supabase**      | [supabase.com](https://supabase.com)                                   | Settings > API > copiar keys        |
| **Meta WhatsApp** | [developers.facebook.com](https://developers.facebook.com)             | Criar App > WhatsApp > obter tokens |
| **Claude**        | [console.anthropic.com](https://console.anthropic.com)                 | API Keys > Create Key               |
| **TMDB**          | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Request API Key (grátis)            |
| **YouTube**       | [console.cloud.google.com](https://console.cloud.google.com)           | Enable YouTube Data API v3          |

## Validação (Zod)

```typescript
// src/config/env.ts
import { z } from "zod";

export const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  META_WHATSAPP_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
  TMDB_API_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().startsWith("AIza"),
  NODE_ENV: z.enum(["development", "production"]),
});

export type Env = z.infer<typeof envSchema>;
```

## Segurança

⚠️ **NUNCA commitar**: `.env`, `.env.production`, `.env.local`  
✅ **Commitar apenas**: `.env.example`  
🔄 **Rotacionar tokens a cada 90 dias**
