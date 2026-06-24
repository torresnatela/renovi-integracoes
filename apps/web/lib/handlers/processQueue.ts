import {
  claimNext,
  getActiveDestination,
  markFailed,
  markSent,
  type Database,
} from "@renovi/db";

const DEFAULT_BACKOFF_MS = 60_000;

export interface TickDeps {
  db: Database;
  fetchFn: typeof fetch;
  now?: Date;
  batchSize?: number;
  backoffMs?: number;
}

export interface TickResult {
  claimed: number;
  sent: number;
  failed: number;
  noDestination: boolean;
}

/**
 * Processa um "tick" da fila: pega o próximo item pendente e envia ao
 * BotConversa. Considera apenas sucesso HTTP (não interpreta a resposta de
 * negócio do BotConversa).
 */
export async function processQueueTick(deps: TickDeps): Promise<TickResult> {
  const now = deps.now ?? new Date();
  const backoffMs = deps.backoffMs ?? DEFAULT_BACKOFF_MS;

  const destination = await getActiveDestination(deps.db);
  if (!destination) {
    return { claimed: 0, sent: 0, failed: 0, noDestination: true };
  }

  const items = await claimNext(deps.db, {
    limit: deps.batchSize ?? 1,
    now,
  });

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await deps.fetchFn(destination.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await markSent(deps.db, item.id, now);
        sent++;
      } else {
        await markFailed(deps.db, item.id, {
          error: `HTTP ${res.status}`,
          now,
          backoffMs,
        });
        failed++;
      }
    } catch (err) {
      await markFailed(deps.db, item.id, {
        error: err instanceof Error ? err.message : String(err),
        now,
        backoffMs,
      });
      failed++;
    }
  }

  return { claimed: items.length, sent, failed, noDestination: false };
}

export interface LoopDeps {
  db: Database;
  fetchFn: typeof fetch;
  tickMs: number;
  maxRuntimeMs: number;
  batchSize?: number;
  backoffMs?: number;
  /** Relógio em ms (injetável para teste). Padrão: Date.now. */
  clock: () => number;
  /** Espera assíncrona (injetável). Padrão: setTimeout. */
  sleep: (ms: number) => Promise<void>;
}

export interface LoopResult {
  ticks: number;
  sent: number;
  failed: number;
}

/**
 * Self-loop: como o Vercel Cron só dispara de minuto em minuto, este endpoint
 * roda em loop por ~maxRuntimeMs, processando a fila a cada tickMs (~5s).
 */
export async function runProcessLoop(deps: LoopDeps): Promise<LoopResult> {
  const start = deps.clock();
  let ticks = 0;
  let sent = 0;
  let failed = 0;

  while (deps.clock() - start < deps.maxRuntimeMs) {
    const result = await processQueueTick({
      db: deps.db,
      fetchFn: deps.fetchFn,
      now: new Date(deps.clock()),
      batchSize: deps.batchSize,
      backoffMs: deps.backoffMs,
    });
    ticks++;
    sent += result.sent;
    failed += result.failed;

    if (deps.clock() - start >= deps.maxRuntimeMs) break;
    await deps.sleep(deps.tickMs);
  }

  return { ticks, sent, failed };
}
