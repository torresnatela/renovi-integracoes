import { beforeEach, describe, expect, it } from "vitest";
import { listQueue, listRecentLogs, type Database } from "@renovi/db";
import { handleRdStationWebhook } from "@/lib/handlers/rdstationWebhook";
import { createTestDb } from "./helpers/testDb";

import iolanda from "../../../packages/core/test/fixtures/rdstation/iolanda.json";
import noPhone from "../../../packages/core/test/fixtures/rdstation/no-phone.json";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
});

describe("handleRdStationWebhook", () => {
  it("logs the raw payload and enqueues a structured item for a lead with a phone", async () => {
    const result = await handleRdStationWebhook({ db, body: iolanda });

    expect(result.leadCount).toBe(1);
    expect(result.enqueued).toBe(1);

    const logs = await listRecentLogs(db, 10);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("parsed");
    expect(logs[0]?.rawPayload).toEqual(iolanda);

    const queue = await listQueue(db, { limit: 10 });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.firstName).toBe("Iolanda");
    expect(queue[0]?.lastName).toBe("Salles Sbeghen");
    expect(queue[0]?.phone).toBe("+55 (66) 999000320");
    expect(queue[0]?.payload).toEqual({
      nome: "Iolanda",
      sobrenome: "Salles Sbeghen",
      telefone: "+55 (66) 999000320",
    });
  });

  it("logs as no_phone and does not enqueue when no phone is present", async () => {
    const result = await handleRdStationWebhook({ db, body: noPhone });

    expect(result.enqueued).toBe(0);
    const logs = await listRecentLogs(db, 10);
    expect(logs[0]?.status).toBe("no_phone");
    expect(await listQueue(db, { limit: 10 })).toHaveLength(0);
  });

  it("is idempotent — re-delivering the same webhook does not duplicate the queue item", async () => {
    await handleRdStationWebhook({ db, body: iolanda });
    const second = await handleRdStationWebhook({ db, body: iolanda });

    expect(second.enqueued).toBe(0); // deduped
    expect(await listQueue(db, { limit: 10 })).toHaveLength(1);
    // Still logged both deliveries.
    expect(await listRecentLogs(db, 10)).toHaveLength(2);
  });

  it("enqueues one item per lead in a multi-lead payload", async () => {
    const body = {
      leads: [iolanda.leads[0], noPhone.leads[0]],
    };
    const result = await handleRdStationWebhook({ db, body });

    expect(result.leadCount).toBe(2);
    expect(result.enqueued).toBe(1); // only the one with a phone
    expect(await listQueue(db, { limit: 10 })).toHaveLength(1);
  });

  it("does not throw on a malformed body and logs it", async () => {
    const result = await handleRdStationWebhook({ db, body: null });
    expect(result.leadCount).toBe(0);
    expect(result.enqueued).toBe(0);
    expect(await listRecentLogs(db, 10)).toHaveLength(1);
  });
});
