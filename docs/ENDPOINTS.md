# API Endpoints

Documentação completa da API REST.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://nexo-ai.your-domain.workers.dev`

## Autenticação

Todos os endpoints (exceto webhook e health) requerem autenticação Supabase Auth.

```http
Authorization: Bearer <supabase_jwt_token>
```

## Health Check

### `GET /health`

Verifica status da API.

**Response:**

````json{
"status": "ok",
"timestamp": "2026-01-05T10:30:00Z",
"version": "1.0.0"
}

---

## Webhooks

### `POST /webhook/meta`

Recebe mensagens do WhatsApp via Meta API.

**Headers:**X-Hub-Signature-256: sha256=<signature>

**Body (Text Message):**
```json{
"object": "whatsapp_business_account",
"entry": [{
"id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
"changes": [{
"value": {
"messaging_product": "whatsapp",
"metadata": {
"display_phone_number": "15550000000",
"phone_number_id": "PHONE_NUMBER_ID"
},
"contacts": [{
"profile": {
"name": "John Doe"
},
"wa_id": "5585999999999"
}],
"messages": [{
"from": "5585999999999",
"id": "wamid.XXX",
"timestamp": "1704448200",
"text": {
"body": "os sete samurais"
},
"type": "text"
}]
},
"field": "messages"
}]
}]
}

**Response:**
```json{
"status": "ok"
}

### `GET /webhook/meta`

Verificação do webhook (Meta requirement).

**Query Params:**
- `hub.mode`: "subscribe"
- `hub.verify_token`: seu VERIFY_TOKEN
- `hub.challenge`: string a retornar

**Response:**<hub.challenge>

---

## Items

### `GET /items`

Lista items do usuário com filtros.

**Query Params:**?type=movie                    # Filtrar por tipo
&status=pending                # Filtrar por status
&tags=terror,ação              # Filtrar por tags (OR)
&search=matrix                 # Full-text search em title/description
&limit=20                      # Itens por página (default: 50)
&offset=0                      # Paginação
&sort=created_at               # Ordenação: created_at | updated_at | title
&order=desc                    # asc | desc

**Response:**
```json{
"data": [
{
"id": "123e4567-e89b-12d3-a456-426614174000",
"userId": "user-uuid",
"type": "movie",
"title": "Fight Club",
"description": "An insomniac office worker...",
"metadata": {
"tmdb_id": 550,
"year": 1999,
"genres": ["Drama"],
"director": "David Fincher",
"tmdb_rating": 8.4,
"streaming": [
{
"provider": "Netflix",
"type": "flatrate"
}
]
},
"tags": ["cult", "psychological"],
"status": "pending",
"createdAt": "2026-01-01T10:00:00Z",
"updatedAt": "2026-01-01T10:00:00Z"
}
],
"pagination": {
"total": 150,
"limit": 20,
"offset": 0,
"hasMore": true
}
}

---

### `GET /items/:id`

Busca item específico por ID.

**Response:**
```json{
"id": "123e4567-e89b-12d3-a456-426614174000",
"userId": "user-uuid",
"type": "movie",
"title": "Fight Club",
"description": "An insomniac office worker...",
"metadata": { ... },
"tags": ["cult", "psychological"],
"status": "pending",
"createdAt": "2026-01-01T10:00:00Z",
"updatedAt": "2026-01-01T10:00:00Z"
}

**Errors:**
- `404`: Item não encontrado
- `403`: Item pertence a outro usuário

---

### `POST /items`

Cria novo item manualmente.

**Body:**
```json{
"type": "movie",
"title": "The Matrix",
"description": "Optional description",
"metadata": {
"year": 1999
},
"tags": ["sci-fi", "action"],
"status": "pending"
}

**Response:** `201 Created`
```json{
"id": "new-uuid",
"userId": "user-uuid",
"type": "movie",
"title": "The Matrix",
"metadata": { ... },
"tags": ["sci-fi", "action"],
"status": "pending",
"createdAt": "2026-01-05T10:00:00Z",
"updatedAt": "2026-01-05T10:00:00Z"
}

**Validations:**
- `type` (required): enum de tipos válidos
- `title` (required): min 1 char, max 500
- `tags` (optional): array de strings
- `status` (optional): default 'pending'

---

### `PATCH /items/:id`

Atualiza item existente.

**Body (partial update):**
```json{
"title": "New title",
"status": "watched",
"tags": ["updated", "tags"]
}

**Response:** `200 OK`
```json{
"id": "item-uuid",
"userId": "user-uuid",
"title": "New title",
"status": "watched",
"tags": ["updated", "tags"],
"updatedAt": "2026-01-05T11:00:00Z",
...
}

**Notes:**
- Apenas campos enviados são atualizados
- `userId` e `id` não podem ser modificados
- `updatedAt` é atualizado automaticamente

---

### `DELETE /items/:id`

Remove item permanentemente.

**Response:** `204 No Content`

**Errors:**
- `404`: Item não encontrado
- `403`: Sem permissão

---

### `POST /items/search`

Busca avançada com múltiplos critérios.

**Body:**
```json{
"query": "matrix",
"filters": {
"types": ["movie", "series"],
"tags": ["sci-fi"],
"status": ["pending", "watched"],
"yearRange": {
"min": 1999,
"max": 2003
},
"hasStreaming": true
},
"sort": {
"field": "metadata->tmdb_rating",
"order": "desc"
},
"limit": 20,
"offset": 0
}

**Response:**
```json{
"results": [...],
"total": 45,
"facets": {
"types": {
"movie": 30,
"series": 15
},
"tags": {
"sci-fi": 45,
"action": 20
}
}
}

---

### `GET /items/stats`

Estatísticas dos items do usuário.

**Response:**
```json{
"total": 250,
"byType": {
"movie": 100,
"video": 50,
"link": 30,
"note": 70
},
"byStatus": {
"pending": 150,
"watched": 80,
"completed": 20
},
"topTags": [
{ "tag": "terror", "count": 45 },
{ "tag": "sci-fi", "count": 38 }
],
"recentActivity": {
"lastAdded": "2026-01-05T10:00:00Z",
"addedThisWeek": 12,
"addedThisMonth": 48
},
"streaming": {
"available": 65,
"unavailable": 35
}
}

---

## Conversas (Admin/Debug only)

### `GET /conversations/:userId`

Lista conversas de um usuário.

**Response:**
```json{
"conversations": [
{
"id": "conv-uuid",
"userId": "user-uuid",
"whatsappChatId": "5585999999999",
"state": "idle",
"lastMessageAt": "2026-01-05T09:30:00Z",
"messagesCount": 15
}
]
}

---

### `GET /conversations/:id/messages`

Histórico de mensagens de uma conversa.

**Query Params:**
- `limit=50` (default: 50, max: 100)
- `before=timestamp` (paginação)

**Response:**
```json{
"messages": [
{
"id": "msg-uuid",
"conversationId": "conv-uuid",
"role": "user",
"content": "os sete samurais",
"metadata": {
"whatsappMessageId": "wamid.XXX"
},
"createdAt": "2026-01-05T09:00:00Z"
},
{
"id": "msg-uuid-2",
"role": "assistant",
"content": "Encontrei 2 filmes: ...",
"metadata": {
"toolCalls": [...]
},
"createdAt": "2026-01-05T09:00:05Z"
}
],
"hasMore": true
}

---

## Auth (Supabase)

### `POST /auth/signup`

Cria nova conta.

**Body:**
```json{
"email": "user@example.com",
"password": "securepass123",
"whatsappNumber": "+5585999999999"
}

**Response:** `201 Created`
```json{
"user": {
"id": "user-uuid",
"email": "user@example.com"
},
"session": {
"access_token": "jwt...",
"refresh_token": "...",
"expires_at": 1704534600
}
}

---

### `POST /auth/login`

Login com credenciais.

**Body:**
```json{
"email": "user@example.com",
"password": "securepass123"
}

**Response:**
```json{
"session": {
"access_token": "jwt...",
"refresh_token": "...",
"expires_at": 1704534600
}
}

---

### `POST /auth/refresh`

Renova token expirado.

**Body:**
```json{
"refresh_token": "..."
}

**Response:**
```json{
"session": {
"access_token": "new_jwt...",
"refresh_token": "...",
"expires_at": 1704538200
}
}

---

### `POST /auth/logout`

Invalida sessão atual.

**Headers:**Authorization: Bearer <token>

**Response:** `204 No Content`

---

## Error Responses

Formato padrão de erro:
```json{
"error": {
"code": "VALIDATION_ERROR",
"message": "Title is required",
"details": {
"field": "title",
"constraint": "required"
}
}
}

### Códigos de Erro

| Status | Code | Descrição |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 401 | `UNAUTHORIZED` | Token inválido/expirado |
| 403 | `FORBIDDEN` | Sem permissão |
| 404 | `NOT_FOUND` | Recurso não existe |
| 409 | `CONFLICT` | Conflito (ex: item duplicado) |
| 429 | `RATE_LIMIT` | Muitas requisições |
| 500 | `INTERNAL_ERROR` | Erro do servidor |
| 503 | `SERVICE_UNAVAILABLE` | Serviço temporariamente indisponível |

---

## Rate Limiting

| Endpoint | Limite |
|----------|--------|
| `/webhook/meta` | 1000/min |
| `/items/*` | 100/min por usuário |
| `/auth/login` | 5/min por IP |
| `/auth/signup` | 3/hour por IP |

**Response quando excedido:**
```json{
"error": {
"code": "RATE_LIMIT",
"message": "Too many requests",
"retryAfter": 60
}
}

**Headers:**X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704448860
Retry-After: 60

---

## Webhooks Outgoing (Futuro)

Permite notificar sistemas externos quando events ocorrem.

### `POST /webhooks` (Admin)

Registra webhook URL.

**Body:**
```json{
"url": "https://your-app.com/webhook",
"events": ["item.created", "item.updated"],
"secret": "your-webhook-secret"
}

### Eventos Disponíveis
- `item.created`
- `item.updated`
- `item.deleted`
- `item.status_changed`

**Payload enviado:**
```json{
"event": "item.created",
"timestamp": "2026-01-05T10:00:00Z",
"data": {
"item": { ... }
}
}

**Headers:**X-Senka-Signature: sha256=...
X-Senka-Event: item.created
````
