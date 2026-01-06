import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { items } from "./items";
import { conversations } from "./conversations";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name"),
  phone: varchar("phone", { length: 256 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  conversations: many(conversations),
}));
