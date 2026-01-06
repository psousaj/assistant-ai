import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { items } from "./items";
import { conversations } from "./conversations";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("full_name"),
  phone: varchar("phone", { length: 256 }),
  email: varchar({ length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  password: varchar("password", { length: 256 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  conversations: many(conversations),
}));
