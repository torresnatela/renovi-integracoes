import { getDb } from "@renovi/db";
import { resendQueueItem } from "@/lib/handlers/resendQueueItem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const db = getDb();
  let body: { id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return Response.json(
      { ok: false, error: "Informe o id do item da fila." },
      { status: 400 },
    );
  }

  const result = await resendQueueItem({ db, fetchFn: fetch, id });
  const httpStatus = result.ok
    ? 200
    : result.reason === "not_found"
      ? 404
      : result.reason === "no_destination"
        ? 409
        : 502;
  return Response.json(result, { status: httpStatus });
}
