import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Log bruto de cada webhook recebido do RD Station (auditoria completa). */
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull().default("rdstation"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  rawPayload: jsonb("raw_payload").notNull(),
  leadCount: integer("lead_count").notNull().default(0),
  // received | parsed | no_phone | error
  status: text("status").notNull().default("received"),
  error: text("error"),
});

/** URL(s) de webhook do BotConversa para onde os dados estruturados são enviados. */
export const botconversaDestinations = pgTable("botconversa_destinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Fila estruturada de envios para o BotConversa. */
export const sendQueue = pgTable("send_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  logId: uuid("log_id").references(() => webhookLogs.id),
  // Chave de idempotência (event_uuid do RD). NULLs são distintos no Postgres.
  dedupeKey: text("dedupe_key").unique(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull(),
  // Objeto exato que será enviado ao BotConversa.
  payload: jsonb("payload").notNull(),
  // pending | processing | sent | failed
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type BotconversaDestination =
  typeof botconversaDestinations.$inferSelect;
export type SendQueueItem = typeof sendQueue.$inferSelect;
export type NewSendQueueItem = typeof sendQueue.$inferInsert;
