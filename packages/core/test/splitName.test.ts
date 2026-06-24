import { describe, expect, it } from "vitest";
import { splitName } from "../src/splitName";

describe("splitName", () => {
  it("splits first word as firstName and the rest as lastName", () => {
    expect(splitName("Iolanda Salles Sbeghen")).toEqual({
      firstName: "Iolanda",
      lastName: "Salles Sbeghen",
    });
  });

  it("keeps lastName empty for a single-word name", () => {
    expect(splitName("Simão")).toEqual({ firstName: "Simão", lastName: "" });
  });

  it("collapses extra whitespace", () => {
    expect(splitName("  Daiane   Gomes  ")).toEqual({
      firstName: "Daiane",
      lastName: "Gomes",
    });
  });

  it("handles all-caps multi-token names", () => {
    expect(splitName("DAIANA ELOI S ALVES")).toEqual({
      firstName: "DAIANA",
      lastName: "ELOI S ALVES",
    });
  });

  it("returns empty parts for empty, null or undefined", () => {
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitName(undefined)).toEqual({ firstName: "", lastName: "" });
  });
});
