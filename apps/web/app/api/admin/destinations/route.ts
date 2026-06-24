import {
  getActiveDestination,
  getDb,
  listDestinations,
  saveDestination,
} from "@renovi/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const db = getDb();
  const [active, all] = await Promise.all([
    getActiveDestination(db),
    listDestinations(db),
  ]);
  return Response.json({ active, all });
}

export async function POST(req: Request): Promise<Response> {
  const db = getDb();
  let body: { name?: unknown; webhookUrl?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const webhookUrl =
    typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  if (!/^https?:\/\//i.test(webhookUrl)) {
    return Response.json(
      { ok: false, error: "Informe uma URL de webhook válida (http/https)." },
      { status: 400 },
    );
  }
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "BotConversa";

  const destination = await saveDestination(db, { name, webhookUrl });
  return Response.json({ ok: true, destination });
}
