import {
  getActiveDestination,
  getQueueItemById,
  markFailed,
  markSent,
  type Database,
} from "@renovi/db";

const DEFAULT_BACKOFF_MS = 60_000;

export interface ResendDeps {
  db: Database;
  fetchFn: typeof fetch;
  id: string;
  now?: Date;
  backoffMs?: number;
}

export interface ResendResult {
  ok: boolean;
  reason?: "not_found" | "no_destination" | "send_failed";
  status?: string;
  error?: string;
}

/**
 * Reenvia o payload de um item da fila ao link ativo do BotConversa,
 * independentemente do status atual (útil para testar/retentar manualmente).
 */
export async function resendQueueItem(deps: ResendDeps): Promise<ResendResult> {
  const now = deps.now ?? new Date();
  const backoffMs = deps.backoffMs ?? DEFAULT_BACKOFF_MS;

  const item = await getQueueItemById(deps.db, deps.id);
  if (!item) return { ok: false, reason: "not_found" };

  const destination = await getActiveDestination(deps.db);
  if (!destination) return { ok: false, reason: "no_destination" };

  try {
    const res = await deps.fetchFn(destination.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    if (res.ok) {
      const updated = await markSent(deps.db, item.id, now);
      return { ok: true, status: updated?.status ?? "sent" };
    }
    const updated = await markFailed(deps.db, item.id, {
      error: `HTTP ${res.status}`,
      now,
      backoffMs,
    });
    return {
      ok: false,
      reason: "send_failed",
      status: updated?.status,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const updated = await markFailed(deps.db, item.id, {
      error: message,
      now,
      backoffMs,
    });
    return {
      ok: false,
      reason: "send_failed",
      status: updated?.status,
      error: message,
    };
  }
}
