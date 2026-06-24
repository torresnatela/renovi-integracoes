export interface SplitName {
  firstName: string;
  lastName: string;
}

/**
 * Divide um nome completo em `firstName` (primeira palavra) e `lastName`
 * (o restante). Colapsa espaços extras. Entrada vazia retorna partes vazias.
 */
export function splitName(full: string | null | undefined): SplitName {
  if (!full) return { firstName: "", lastName: "" };

  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", lastName: "" };

  const [firstName, ...rest] = tokens;
  return { firstName: firstName ?? "", lastName: rest.join(" ") };
}
