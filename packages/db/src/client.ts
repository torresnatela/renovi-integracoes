import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Tipo de banco aceito pelos repositórios. Propositalmente largo (`any` no HKT
 * de resultado) para aceitar tanto o driver de produção (postgres-js / Neon)
 * quanto o PGlite usado nos testes — ambos estendem PgDatabase.
 */
export type Database = PgDatabase<any, typeof schema, any>;

export function createDbClient(connectionString: string): Database {
  // `prepare: false` é necessário para o endpoint com pool (PgBouncer) do Neon.
  const sql = postgres(connectionString, { prepare: false });
  return drizzle(sql, { schema }) as unknown as Database;
}

let cached: Database | undefined;

/** Cliente singleton lendo DATABASE_URL (uso em produção / serverless). */
export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não está definida.");
  }
  cached = createDbClient(url);
  return cached;
}
