import { formatPhoneBR } from "./formatPhoneBR";
import { splitName } from "./splitName";
import { asRecord, asString, parseJsonObject } from "./internal/obj";

export interface RdLeadContact {
  firstName: string;
  lastName: string;
  phone: string;
}

/** O payload "real" do evento fica em content.__cdp__original_event.payload. */
function payloadOf(content: Record<string, unknown> | undefined) {
  return asRecord(asRecord(content?.["__cdp__original_event"])?.["payload"]);
}

/** Campos de formulário ficam numa string JSON em content.conversion_payload (ou dentro do payload). */
function formFieldsOf(content: Record<string, unknown> | undefined) {
  return (
    parseJsonObject(content?.["conversion_payload"]) ??
    parseJsonObject(payloadOf(content)?.["conversion_payload"])
  );
}

function phonesFromContent(
  content: Record<string, unknown> | undefined,
): Array<string | undefined> {
  const payload = payloadOf(content);
  const form = formFieldsOf(content);
  return [
    asString(payload?.["personal_phone"]),
    asString(payload?.["mobile_phone"]),
    asString(content?.["Telefone"]),
    asString(content?.["Celular"]),
    asString(form?.["form_fields_telefone"]),
    asString(form?.["form_fields_celular"]),
  ];
}

function namesFromContent(
  content: Record<string, unknown> | undefined,
): Array<string | undefined> {
  const payload = payloadOf(content);
  const form = formFieldsOf(content);
  return [
    asString(payload?.["name"]),
    asString(content?.["Nome"]),
    asString(form?.["form_fields_name"]),
  ];
}

/**
 * Encontra Nome, Sobrenome e Telefone de um lead do RD Station, lidando com os
 * vários formatos/locais possíveis. O telefone é o dado obrigatório: sem um
 * telefone válido a função retorna `null` (lead deve apenas ser logado).
 */
export function extractLeadContact(lead: unknown): RdLeadContact | null {
  const l = asRecord(lead);
  if (!l) return null;

  const first = asRecord(asRecord(l["first_conversion"])?.["content"]);
  const last = asRecord(asRecord(l["last_conversion"])?.["content"]);

  const phoneCandidates: Array<string | undefined> = [
    ...phonesFromContent(first),
    ...phonesFromContent(last),
    asString(l["personal_phone"]),
    asString(l["mobile_phone"]),
    asString(l["phone"]),
  ];

  let phone: string | null = null;
  for (const candidate of phoneCandidates) {
    const formatted = formatPhoneBR(candidate);
    if (formatted) {
      phone = formatted;
      break;
    }
  }
  if (!phone) return null;

  const nameCandidates: Array<string | undefined> = [
    ...namesFromContent(first),
    ...namesFromContent(last),
    asString(l["name"]),
  ];
  // Um nome é utilizável se não for vazio nem parecer um e-mail.
  const usableName = nameCandidates.find(
    (n): n is string => !!n && !n.includes("@"),
  );

  const { firstName, lastName } = splitName(usableName ?? "");
  return { firstName, lastName, phone };
}
