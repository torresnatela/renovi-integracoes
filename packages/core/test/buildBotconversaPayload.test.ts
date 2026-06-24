import { describe, expect, it } from "vitest";
import { buildBotconversaPayload } from "../src/buildBotconversaPayload";

describe("buildBotconversaPayload", () => {
  it("maps a contact to the BotConversa field names", () => {
    expect(
      buildBotconversaPayload({
        firstName: "Iolanda",
        lastName: "Salles Sbeghen",
        phone: "+55 (66) 999000320",
      }),
    ).toEqual({
      nome: "Iolanda",
      sobrenome: "Salles Sbeghen",
      telefone: "+55 (66) 999000320",
    });
  });

  it("keeps an empty sobrenome when there is no last name", () => {
    expect(
      buildBotconversaPayload({
        firstName: "Simão",
        lastName: "",
        phone: "+55 (17) 990204138",
      }),
    ).toEqual({ nome: "Simão", sobrenome: "", telefone: "+55 (17) 990204138" });
  });
});
