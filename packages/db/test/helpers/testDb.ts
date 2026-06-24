import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "../../src/client";
import * as schema from "../../src/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../drizzle");

/**
 * Cria um Postgres real, em processo (PGlite), com o schema migrado.
 * Cada chamada é totalmente isolada — ideal para testes.
 */
export async function createTestDb(): Promise<{
  db: Database;
  client: PGlite;
}> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  await migrate(pgliteDb, { migrationsFolder });
  return { db: pgliteDb as unknown as Database, client };
}
