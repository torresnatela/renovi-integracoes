import { desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  botconversaDestinations,
  type BotconversaDestination,
} from "../schema";

export async function getActiveDestination(
  db: Database,
): Promise<BotconversaDestination | null> {
  const [row] = await db
    .select()
    .from(botconversaDestinations)
    .where(eq(botconversaDestinations.isActive, true))
    .orderBy(desc(botconversaDestinations.createdAt))
    .limit(1);
  return row ?? null;
}

export interface SaveDestinationInput {
  name: string;
  webhookUrl: string;
}

/**
 * Salva uma nova URL de destino como ativa, desativando as anteriores.
 * Mantém histórico das URLs já cadastradas.
 */
export async function saveDestination(
  db: Database,
  input: SaveDestinationInput,
): Promise<BotconversaDestination> {
  return db.transaction(async (tx) => {
    await tx
      .update(botconversaDestinations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(botconversaDestinations.isActive, true));

    const [row] = await tx
      .insert(botconversaDestinations)
      .values({
        name: input.name,
        webhookUrl: input.webhookUrl,
        isActive: true,
      })
      .returning();
    return row!;
  });
}

export async function listDestinations(
  db: Database,
): Promise<BotconversaDestination[]> {
  return db
    .select()
    .from(botconversaDestinations)
    .orderBy(desc(botconversaDestinations.createdAt));
}
