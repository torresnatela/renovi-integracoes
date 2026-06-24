import { describe, expect, it } from "vitest";
import { dedupeKey } from "../src/dedupeKey";

import iolanda from "./fixtures/rdstation/iolanda.json";
import douglas from "./fixtures/rdstation/douglas-form.json";

describe("dedupeKey", () => {
  it("uses the last_conversion CDP event_uuid when present", () => {
    expect(dedupeKey(iolanda.leads[0])).toBe(
      "d60b72f5-c1ca-4d84-afd6-331b52a26955",
    );
  });

  it("uses the last_conversion event_uuid for form leads too", () => {
    expect(dedupeKey(douglas.leads[0])).toBe(
      "6cefa915-b486-46be-9ee8-fd4ee670f26f",
    );
  });

  it("falls back to uuid:number_conversions when no event_uuid exists", () => {
    const lead = { uuid: "abc-123", number_conversions: "3" };
    expect(dedupeKey(lead)).toBe("abc-123:3");
  });

  it("returns undefined when nothing identifies the lead", () => {
    expect(dedupeKey({})).toBeUndefined();
    expect(dedupeKey(null)).toBeUndefined();
  });
});
