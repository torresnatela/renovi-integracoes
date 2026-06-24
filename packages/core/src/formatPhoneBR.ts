/**
 * Normaliza um telefone brasileiro vindo em formatos variados (mascarado, com
 * ou sem DDI) para o formato `+55 (DD) NNNNNNNNN`.
 *
 * Regras:
 * - mantém apenas dígitos;
 * - se começar com `55` e tiver mais de 11 dígitos, remove o DDI `55`;
 * - precisa sobrar 10 (DDD + 8) ou 11 (DDD + 9) dígitos, senão retorna `null`.
 */
export function formatPhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");

  // Remove o DDI 55 apenas quando há dígitos demais para um número nacional.
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return null;
  }

  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  return `+55 (${ddd}) ${number}`;
}
