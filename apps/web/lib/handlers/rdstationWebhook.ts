import {
  buildBotconversaPayload,
  dedupeKey,
  extractLeadContact,
} from "@renovi/core";
import { enqueue, insertLog, updateLogStatus, type Database } from "@renovi/db";

export interface WebhookResult {
  logId: string;
  leadCount: number;
  /** Leads que tinham telefone válido (independente de dedupe). */
  withPhone: number;
  /** Itens efetivamente inseridos na fila (exclui duplicados). */
  enqueued: number;
  /** Leads sem telefone (apenas logados). */
  skipped: number;
}

function extractLeads(body: unknown): unknown[] {
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { leads?: unknown }).leads)
  ) {
    return (body as { leads: unknown[] }).leads;
  }
  return [];
}

/**
 * Processa um webhook do RD Station:
 * 1. registra o payload bruto;
 * 2. extrai nome/sobrenome/telefone de cada lead;
 * 3. enfileira (idempotente) os que têm telefone válido;
 * 4. marca o status final do log.
 */
export async function handleRdStationWebhook({
  db,
  body,
}: {
  db: Database;
  body: unknown;
}): Promise<WebhookResult> {
  const leads = extractLeads(body);

  // raw_payload é NOT NULL; corpos vazios/ inválidos viram um marcador auditável.
  const rawPayload = body ?? { _empty: true };

  const log = await insertLog(db, {
    rawPayload,
    leadCount: leads.length,
    status: "received",
  });

  let withPhone = 0;
  let enqueued = 0;

  for (const lead of leads) {
    const contact = extractLeadContact(lead);
    if (!contact) continue;
    withPhone++;

    const inserted = await enqueue(db, {
      logId: log.id,
      dedupeKey: dedupeKey(lead) ?? null,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      payload: buildBotconversaPayload(contact),
    });
    if (inserted) enqueued++;
  }

  const status =
    withPhone > 0 ? "parsed" : leads.length > 0 ? "no_phone" : "received";
  await updateLogStatus(db, log.id, status);

  return {
    logId: log.id,
    leadCount: leads.length,
    withPhone,
    enqueued,
    skipped: leads.length - withPhone,
  };
}
