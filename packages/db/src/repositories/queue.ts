import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import type { Database } from "../client";
import { sendQueue, type SendQueueItem } from "../schema";

export interface EnqueueInput {
  logId?: string | null;
  dedupeKey?: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  payload: unknown;
  maxAttempts?: number;
}

/**
 * Insere um item na fila. É idempotente por `dedupeKey`: se já existir um item
 * com a mesma chave, nada é inserido e retorna `null`.
 */
export async function enqueue(
  db: Database,
  input: EnqueueInput,
): Promise<SendQueueItem | null> {
  const rows = await db
    .insert(sendQueue)
    .values({
      logId: input.logId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      payload: input.payload,
      ...(input.maxAttempts !== undefined
        ? { maxAttempts: input.maxAttempts }
        : {}),
    })
    .onConflictDoNothing({ target: sendQueue.dedupeKey })
    .returning();
  return rows[0] ?? null;
}

export interface ClaimOptions {
  limit?: number;
  now?: Date;
}

/**
 * Reivindica atomicamente os próximos itens `pending` prontos para envio,
 * marcando-os como `processing`. Usa FOR UPDATE SKIP LOCKED para evitar que
 * invocações concorrentes do cron peguem o mesmo item.
 */
export async function claimNext(
  db: Database,
  options: ClaimOptions = {},
): Promise<SendQueueItem[]> {
  const limit = options.limit ?? 1;
  const now = options.now ?? new Date();

  return db.transaction(async (tx) => {
    const candidates = await tx
      .select({ id: sendQueue.id })
      .from(sendQueue)
      .where(
        and(eq(sendQueue.status, "pending"), lte(sendQueue.nextAttemptAt, now)),
      )
      .orderBy(asc(sendQueue.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];

    const ids = candidates.map((c) => c.id);
    return tx
      .update(sendQueue)
      .set({ status: "processing", updatedAt: now })
      .where(inArray(sendQueue.id, ids))
      .returning();
  });
}

export async function markSent(
  db: Database,
  id: string,
  now: Date = new Date(),
): Promise<SendQueueItem | null> {
  const [row] = await db
    .update(sendQueue)
    .set({ status: "sent", sentAt: now, updatedAt: now, lastError: null })
    .where(eq(sendQueue.id, id))
    .returning();
  return row ?? null;
}

export interface MarkFailedOptions {
  error: string;
  now?: Date;
  backoffMs: number;
}

/**
 * Marca uma tentativa como falha. Incrementa `attempts`; enquanto não atingir
 * `maxAttempts`, volta para `pending` com `nextAttemptAt` no futuro (backoff).
 * Ao atingir o limite, marca como `failed`.
 */
export async function markFailed(
  db: Database,
  id: string,
  options: MarkFailedOptions,
): Promise<SendQueueItem | null> {
  const now = options.now ?? new Date();
  const [current] = await db
    .select()
    .from(sendQueue)
    .where(eq(sendQueue.id, id))
    .limit(1);
  if (!current) return null;

  const attempts = current.attempts + 1;
  const failed = attempts >= current.maxAttempts;

  const [row] = await db
    .update(sendQueue)
    .set({
      attempts,
      lastError: options.error,
      updatedAt: now,
      status: failed ? "failed" : "pending",
      nextAttemptAt: failed
        ? current.nextAttemptAt
        : new Date(now.getTime() + options.backoffMs),
    })
    .where(eq(sendQueue.id, id))
    .returning();
  return row ?? null;
}

export interface ListQueueOptions {
  status?: string;
  limit?: number;
}

export async function listQueue(
  db: Database,
  options: ListQueueOptions = {},
): Promise<SendQueueItem[]> {
  const limit = options.limit ?? 50;
  const base = db.select().from(sendQueue);
  const rows = options.status
    ? await base
        .where(eq(sendQueue.status, options.status))
        .orderBy(desc(sendQueue.createdAt))
        .limit(limit)
    : await base.orderBy(desc(sendQueue.createdAt)).limit(limit);
  return rows;
}
