import { getDb, listRecentLogs } from "@renovi/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const db = getDb();
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const logs = await listRecentLogs(db, Math.min(Math.max(limit, 1), 200));
  return Response.json({ logs });
}
