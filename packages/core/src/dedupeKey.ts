import { asRecord, asString } from "./internal/obj";

function eventUuidOf(conversion: unknown): string | undefined {
  const content = asRecord(asRecord(conversion)?.["content"]);
  const event = asRecord(content?.["__cdp__original_event"]);
  return asString(event?.["event_uuid"]);
}

/**
 * Chave estável para evitar enfileirar o mesmo evento duas vezes quando o RD
 * Station reenvia (retry) o webhook. Prioriza o event_uuid do evento que
 * disparou o webhook (last_conversion), com fallbacks progressivos.
 */
export function dedupeKey(lead: unknown): string | undefined {
  const l = asRecord(lead);
  if (!l) return undefined;

  const lastUuid = eventUuidOf(l["last_conversion"]);
  if (lastUuid) return lastUuid;

  const firstUuid = eventUuidOf(l["first_conversion"]);
  if (firstUuid) return firstUuid;

  const uuid = asString(l["uuid"]);
  if (uuid) {
    const conversions =
      asString(l["number_conversions"]) ??
      (typeof l["number_conversions"] === "number"
        ? String(l["number_conversions"])
        : "0");
    return `${uuid}:${conversions}`;
  }

  return undefined;
}
