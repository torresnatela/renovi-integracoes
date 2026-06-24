/** Helpers internos para navegar com segurança em payloads desestruturados. */

export function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null
    ? (v as Record<string, unknown>)
    : undefined;
}

export function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export function parseJsonObject(
  v: unknown,
): Record<string, unknown> | undefined {
  const s = asString(v);
  if (!s) return undefined;
  try {
    return asRecord(JSON.parse(s));
  } catch {
    return undefined;
  }
}
