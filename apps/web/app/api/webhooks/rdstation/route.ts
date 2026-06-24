import { getDb } from "@renovi/db";
import { handleRdStationWebhook } from "@/lib/handlers/rdstationWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint que deve ser cadastrado no RD Station como destino do webhook.
 * Sempre responde rápido com 2xx em caso de sucesso (o RD espera 2xx).
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  try {
    const db = getDb();
    const result = await handleRdStationWebhook({ db, body });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[webhook:rdstation] erro ao processar", err);
    return Response.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
