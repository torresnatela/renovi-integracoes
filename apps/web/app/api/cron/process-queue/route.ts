import { getDb } from "@renovi/db";
import { runProcessLoop } from "@/lib/handlers/processQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// O loop interno roda por ~maxRuntimeMs (< maxDuration).
export const maxDuration = 60;

async function handle(): Promise<Response> {
  const db = getDb();
  const tickMs = Number(process.env.CRON_TICK_MS ?? 5_000);
  const maxRuntimeMs = Number(process.env.CRON_MAX_RUNTIME_MS ?? 55_000);
  const batchSize = Number(process.env.CRON_BATCH_SIZE ?? 1);

  const result = await runProcessLoop({
    db,
    fetchFn: fetch,
    tickMs,
    maxRuntimeMs,
    batchSize,
    clock: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });

  return Response.json({ ok: true, ...result });
}

// Vercel Cron dispara via GET; agendadores externos costumam usar GET ou POST.
export const GET = handle;
export const POST = handle;
