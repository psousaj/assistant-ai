# Deployment - Cloudflare Workers

Guia para deploy do projeto.

## Pré-requisitos

- Conta Cloudflare (free tier OK)
- Bun instalado
- Wrangler CLI: `bun install -g wrangler`
- Projeto Supabase criado

## Setup Rápido

### 1. Instalar e fazer login

```bash
bun install
wrangler login
```

### 2. Configurar `wrangler.toml`

```toml
name = "nexo-ai"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"
APP_URL = "https://nexo-ai.your-domain.workers.dev"
```

### 3. Adicionar Secrets

```bash
# Database
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DATABASE_URL

# WhatsApp
wrangler secret put META_WHATSAPP_TOKEN
wrangler secret put META_WHATSAPP_PHONE_NUMBER_ID
wrangler secret put META_VERIFY_TOKEN

# AI & APIs
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put TMDB_API_KEY
wrangler secret put YOUTUBE_API_KEY

# Security
wrangler secret put WEBHOOK_SECRET
```

### 4. Deploy

```bash
# Build
bun run build

# Deploy
wrangler deploy

# Logs em tempo real
wrangler tail
```

## Configuração Supabase

### 1. Aplicar migrations

```bash
bun run drizzle-kit generate:pg
bun run drizzle-kit push:pg
```

### 2. Configurar RLS

```sql
-- Executar no SQL Editor do Supabase

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (usuário acessa apenas seus dados)
CREATE POLICY "Users own data" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users own items" ON items
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth.uid() = id));
```

## Configuração Meta WhatsApp

### 1. Criar App

1. Acessar [developers.facebook.com](https://developers.facebook.com/apps)
2. Criar App > Tipo: Business
3. Adicionar produto: WhatsApp
4. Copiar Phone Number ID e Token

### 2. Configurar Webhook

**URL**: `https://nexo-ai.your-domain.workers.dev/webhook/meta`  
**Verify Token**: (mesmo do `.env`)  
**Campos**: `messages`

**Teste de verificação**:

```bash
# Meta envia GET para verificar
# Seu endpoint deve retornar o challenge recebido
```

### 3. Enviar mensagem teste

```bash
curl -X POST "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5585999999999",
    "type": "text",
    "text": {"body": "Olá! Sou o Nexo AI 🤖"}
  }'
```

## Custom Domain (Opcional)

```bash
# Via Wrangler
wrangler publish --route "api.seu-dominio.com/*"
```

**DNS**:

- Type: CNAME
- Name: `api`
- Target: `nexo-ai.your-username.workers.dev`
- Proxy: Enabled

## Monitoring

### Logs

```bash
# Tempo real
wrangler tail

# Filtrar errors
wrangler tail --status error
```

### Dashboard

Cloudflare Dashboard > Workers > nexo-ai > Metrics

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Secrets necessários**:

- `CLOUDFLARE_API_TOKEN`

## Rollback

```bash
# Listar deploys
wrangler deployments list

# Rollback
wrangler rollback
```

## Custos Estimados

### Free Tier

- Cloudflare Workers: 100k req/dia
- Supabase: 500MB DB, 2GB bandwidth
- TMDB: 40 req/10s
- YouTube: 10k units/dia

### Escala (1000 usuários)

- Cloudflare: ~$5-10/mês
- Supabase: ~$25/mês
- Claude API: ~$50-100/mês
- WhatsApp: ~$0-50/mês

**Total**: ~$80-185/mês

## Checklist de Deploy

- [ ] Secrets configurados
- [ ] Migrations aplicadas
- [ ] RLS habilitado
- [ ] Webhook Meta configurado
- [ ] Health check respondendo (`/health`)
- [ ] DNS configurado (se custom domain)
- [ ] Monitoring ativo

## Troubleshooting

### Worker não responde

```bash
wrangler tail --status error
wrangler deploy --force
```

### Erro de conexão Database

- Verificar IP whitelist no Supabase (deve ser `0.0.0.0/0` para Workers)
- Testar: `psql $DATABASE_URL`

### Webhook não recebe mensagens

1. Verificar URL acessível: `curl https://your-worker.dev/webhook/meta`
2. Confirmar verify_token correto
3. Ver logs: `wrangler tail`
