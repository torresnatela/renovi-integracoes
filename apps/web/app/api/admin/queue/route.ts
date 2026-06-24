import { getDb, listQueue } from "@renovi/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const db = getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const items = await listQueue(db, {
    status,
    limit: Math.min(Math.max(limit, 1), 200),
  });
  return Response.json({ items });
}
