import { describe, expect, it } from "vitest";
import { formatPhoneBR } from "../src/formatPhoneBR";

describe("formatPhoneBR", () => {
  it("formats a full +55 mobile with mask into +55 (DD) NNNNNNNNN", () => {
    // From lead "Iolanda": payload.personal_phone "+55 (66) 99900-0320"
    expect(formatPhoneBR("+55 (66) 99900-0320")).toBe("+55 (66) 999000320");
  });

  it("formats a masked mobile without DDI by assuming Brazil", () => {
    // From lead "Daiane": form_fields_telefone "(11) 97606-8782"
    expect(formatPhoneBR("(11) 97606-8782")).toBe("+55 (11) 976068782");
  });

  it("formats raw digits without DDI", () => {
    // From lead "Douglas": form_fields_telefone "31996831103"
    expect(formatPhoneBR("31996831103")).toBe("+55 (31) 996831103");
  });

  it("formats raw 11-digit mobile already without DDI", () => {
    // From lead "danibsmix": mobile_phone "11981521645"
    expect(formatPhoneBR("11981521645")).toBe("+55 (11) 981521645");
  });

  it("strips the leading 55 country code when present", () => {
    expect(formatPhoneBR("5511999998888")).toBe("+55 (11) 999998888");
  });

  it("strips DDI from a fully masked +55 number", () => {
    // From lead "andre": mobile_phone "+55 (84) 98860-1234"
    expect(formatPhoneBR("+55 (84) 98860-1234")).toBe("+55 (84) 988601234");
  });

  it("keeps DDD 55 when the number is only 11 digits (no DDI)", () => {
    expect(formatPhoneBR("55999887766")).toBe("+55 (55) 999887766");
  });

  it("formats a 10-digit landline", () => {
    expect(formatPhoneBR("1133224455")).toBe("+55 (11) 33224455");
  });

  it("returns null for too-short numbers", () => {
    expect(formatPhoneBR("123")).toBeNull();
  });

  it("returns null for empty, null or undefined", () => {
    expect(formatPhoneBR("")).toBeNull();
    expect(formatPhoneBR(null)).toBeNull();
    expect(formatPhoneBR(undefined)).toBeNull();
  });

  it("returns null for numbers with an implausible digit count", () => {
    // 12 digits not starting with 55 cannot be split into DDD + 8/9.
    expect(formatPhoneBR("123456789012")).toBeNull();
  });
});
