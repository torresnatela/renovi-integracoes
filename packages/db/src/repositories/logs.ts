import { desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { webhookLogs, type WebhookLog } from "../schema";

export interface InsertLogInput {
  source?: string;
  rawPayload: unknown;
  leadCount: number;
  status?: string;
  error?: string | null;
}

export async function insertLog(
  db: Database,
  input: InsertLogInput,
): Promise<WebhookLog> {
  const [row] = await db
    .insert(webhookLogs)
    .values({
      source: input.source ?? "rdstation",
      rawPayload: input.rawPayload,
      leadCount: input.leadCount,
      status: input.status ?? "received",
      error: input.error ?? null,
    })
    .returning();
  return row!;
}

export async function updateLogStatus(
  db: Database,
  id: string,
  status: string,
  error?: string | null,
): Promise<WebhookLog | null> {
  const [row] = await db
    .update(webhookLogs)
    .set({ status, error: error ?? null })
    .where(eq(webhookLogs.id, id))
    .returning();
  return row ?? null;
}

export async function listRecentLogs(
  db: Database,
  limit = 50,
): Promise<WebhookLog[]> {
  return db
    .select()
    .from(webhookLogs)
    .orderBy(desc(webhookLogs.receivedAt))
    .limit(limit);
}
