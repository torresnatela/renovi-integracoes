import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema, type Database } from "@renovi/db";

const here = path.dirname(fileURLToPath(import.meta.url));
// Reaproveita as migrations geradas no pacote @renovi/db.
const migrationsFolder = path.resolve(here, "../../../../packages/db/drizzle");

export async function createTestDb(): Promise<{
  db: Database;
  client: PGlite;
}> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  return { db: pgliteDb as unknown as Database, client };
}
