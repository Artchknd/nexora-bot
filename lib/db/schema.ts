import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    contextKey: text("context_key").notNull(),
    role: text("role").$type<"user" | "model">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_context_idx").on(t.contextKey, t.id)],
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  style: text("style"),
  model: text("model"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
