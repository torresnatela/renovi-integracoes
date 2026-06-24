import { describe, expect, it } from "vitest";
import { extractLeadContact } from "../src/extractLeadContact";

import iolanda from "./fixtures/rdstation/iolanda.json";
import simao from "./fixtures/rdstation/simao.json";
import douglas from "./fixtures/rdstation/douglas-form.json";
import daiane from "./fixtures/rdstation/daiane-form.json";
import danibsmix from "./fixtures/rdstation/danibsmix.json";
import noPhone from "./fixtures/rdstation/no-phone.json";

describe("extractLeadContact", () => {
  it("extracts from __cdp__ payload.personal_phone + payload.name (funnel conversion)", () => {
    expect(extractLeadContact(iolanda.leads[0])).toEqual({
      firstName: "Iolanda",
      lastName: "Salles Sbeghen",
      phone: "+55 (66) 999000320",
    });
  });

  it("extracts from payload.mobile_phone with single-word name", () => {
    expect(extractLeadContact(simao.leads[0])).toEqual({
      firstName: "Simão",
      lastName: "",
      phone: "+55 (17) 990204138",
    });
  });

  it("extracts phone+name from the stringified conversion_payload form_fields (form lead)", () => {
    // lead.name is the email here, so it must be ignored in favor of form_fields_name.
    expect(extractLeadContact(douglas.leads[0])).toEqual({
      firstName: "Douglas",
      lastName: "",
      phone: "+55 (31) 996831103",
    });
  });

  it("extracts multi-word name and phone from form_fields", () => {
    expect(extractLeadContact(daiane.leads[0])).toEqual({
      firstName: "Daiane",
      lastName: "Gomes",
      phone: "+55 (11) 976068782",
    });
  });

  it("extracts from top-level / payload mobile_phone with all-caps name", () => {
    expect(extractLeadContact(danibsmix.leads[0])).toEqual({
      firstName: "APARECIDA",
      lastName: "DANIELE DE OLIVEIRA",
      phone: "+55 (11) 981521645",
    });
  });

  it("returns null when no valid phone exists anywhere (CRM-only event)", () => {
    expect(extractLeadContact(noPhone.leads[0])).toBeNull();
  });

  it("returns a contact with empty name parts when only a phone is present", () => {
    const lead = { personal_phone: "11999998888" };
    expect(extractLeadContact(lead)).toEqual({
      firstName: "",
      lastName: "",
      phone: "+55 (11) 999998888",
    });
  });

  it("ignores an email used as the lead name", () => {
    const lead = { name: "foo@bar.com", mobile_phone: "11999998888" };
    expect(extractLeadContact(lead)).toEqual({
      firstName: "",
      lastName: "",
      phone: "+55 (11) 999998888",
    });
  });

  it("returns null for non-object input", () => {
    expect(extractLeadContact(null)).toBeNull();
    expect(extractLeadContact(undefined)).toBeNull();
    expect(extractLeadContact("nope")).toBeNull();
  });
});
