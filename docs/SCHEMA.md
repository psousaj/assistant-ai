# Database Schema

Schema PostgreSQL usando Drizzle ORM com JSONB para metadados flexíveis.

### `users` table

```typescript
// src/db/schema/users.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  whatsappNumber: text("whatsapp_number").notNull().unique(),
  name: text("name"),
  preferences: jsonb("preferences")
    .$type<{
      language?: string;
      timezone?: string;
      notifications?: boolean;
    }>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### `items` table (principal)

```typescript
// src/db/schema/items.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Campos estruturados
    type: text("type").notNull(), // 'movie' | 'video' | 'link' | 'note' | 'music' | 'game' | 'library' | 'reminder'
    title: text("title").notNull(),
    description: text("description"),

    // Dados flexíveis em JSONB
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Status e tracking
    status: text("status").default("pending"), // 'pending' | 'watched' | 'completed' | 'archived'

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes para performance
    userIdIdx: index("items_user_id_idx").on(table.userId),
    typeIdx: index("items_type_idx").on(table.type),
    statusIdx: index("items_status_idx").on(table.status),

    // GIN indexes para JSONB (permite queries dentro do JSON)
    metadataIdx: index("items_metadata_idx").using("gin", table.metadata),
    tagsIdx: index("items_tags_idx").using("gin", table.tags),

    // Composite index para queries comuns
    userTypeIdx: index("items_user_type_idx").on(table.userId, table.type),
    userStatusIdx: index("items_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);
```

### `conversations` table

```typescript
// src/db/schema/conversations.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // WhatsApp chat identifier
    whatsappChatId: text("whatsapp_chat_id").notNull(),

    // State machine
    state: text("state").default("idle"), // 'idle' | 'awaiting_confirmation' | 'enriching' | 'saving'

    // Context temporário da conversa
    context: jsonb("context")
      .$type<{
        pendingItem?: Partial<Item>;
        searchResults?: any[];
        lastIntent?: string;
        confirmationData?: any;
      }>()
      .default({}),

    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
    whatsappChatIdIdx: index("conversations_whatsapp_chat_id_idx").on(
      table.whatsappChatId
    ),
  })
);
```

### `messages` table

```typescript
// src/db/schema/messages.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),

    // Quem enviou
    role: text("role").notNull(), // 'user' | 'assistant'

    // Conteúdo
    content: text("content").notNull(),

    // Metadados opcionais
    metadata: jsonb("metadata").$type<{
      whatsappMessageId?: string;
      toolCalls?: any[];
      attachments?: any[];
      enrichmentData?: any;
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(
      table.conversationId
    ),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
  })
);
```

## Relationships (ERD)

```
users (1) ──────< (N) items
  │
  └──────< (N) conversations
                │
                └──────< (N) messages
```

## Export consolidado

```typescript
// src/db/schema/index.ts
export * from "./users";
export * from "./items";
export * from "./conversations";
export * from "./messages";

// Relations (Drizzle)
import { relations } from "drizzle-orm";
import { users, items, conversations, messages } from "./";

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  conversations: many(conversations),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  user: one(users, {
    fields: [items.userId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
```

## Migrations

### Criar migration

```bash
bun run drizzle-kit generate:pg
```

### Aplicar migrations

```bash
bun run drizzle-kit push:pg
```

### Exemplo de migration gerada

```sql
-- migrations/0000_create_tables.sql

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "whatsapp_number" text NOT NULL UNIQUE,
  "name" text,
  "preferences" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Items
CREATE TABLE IF NOT EXISTS "items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "metadata" jsonb,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "status" text DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX "items_user_id_idx" ON "items"("user_id");
CREATE INDEX "items_type_idx" ON "items"("type");
CREATE INDEX "items_status_idx" ON "items"("status");
CREATE INDEX "items_metadata_idx" ON "items" USING GIN("metadata");
CREATE INDEX "items_tags_idx" ON "items" USING GIN("tags");
CREATE INDEX "items_user_type_idx" ON "items"("user_id", "type");
CREATE INDEX "items_user_status_idx" ON "items"("user_id", "status");

-- Conversations
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "whatsapp_chat_id" text NOT NULL,
  "state" text DEFAULT 'idle',
  "context" jsonb DEFAULT '{}'::jsonb,
  "last_message_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");
CREATE INDEX "conversations_whatsapp_chat_id_idx" ON "conversations"("whatsapp_chat_id");

-- Messages
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
```

## Row Level Security (RLS)

```sql
-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas (usuário só acessa seus próprios dados)
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own items" ON items
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth.uid() = id));

CREATE POLICY "Users can insert own items" ON items
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE auth.uid() = id));

-- Similar para conversations e messages
```
