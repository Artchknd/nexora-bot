import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    model: text("model").notNull(),
    ok: boolean("ok").notNull(),
    httpStatus: integer("http_status"),
    errorKind: text("error_kind"),
    errorMessage: text("error_message"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    thoughtTokens: integer("thought_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("usage_logs_user_idx").on(t.userId, t.createdAt)],
);
