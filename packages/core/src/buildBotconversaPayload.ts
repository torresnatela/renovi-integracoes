import type { RdLeadContact } from "./extractLeadContact";

export interface BotconversaPayload {
  nome: string;
  sobrenome: string;
  telefone: string;
}

/**
 * Monta o objeto que será enviado ao webhook do BotConversa. Os nomes dos
 * campos são genéricos de propósito — o mapeamento final é feito no BotConversa.
 */
export function buildBotconversaPayload(
  contact: RdLeadContact,
): BotconversaPayload {
  return {
    nome: contact.firstName,
    sobrenome: contact.lastName,
    telefone: contact.phone,
  };
}
