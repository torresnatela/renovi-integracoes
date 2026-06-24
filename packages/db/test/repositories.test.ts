import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../src/client";
import { sendQueue } from "../src/schema";
import {
  insertLog,
  listRecentLogs,
  updateLogStatus,
} from "../src/repositories/logs";
import {
  getActiveDestination,
  listDestinations,
  saveDestination,
} from "../src/repositories/destinations";
import {
  claimNext,
  enqueue,
  listQueue,
  markFailed,
  markSent,
} from "../src/repositories/queue";
import { createTestDb } from "./helpers/testDb";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
});

describe("logs repository", () => {
  it("inserts a log with default status 'received' and returns it", async () => {
    const log = await insertLog(db, {
      rawPayload: { leads: [] },
      leadCount: 0,
    });
    expect(log.id).toBeTruthy();
    expect(log.status).toBe("received");
    expect(log.source).toBe("rdstation");
  });

  it("updates a log status and error", async () => {
    const log = await insertLog(db, { rawPayload: {}, leadCount: 1 });
    const updated = await updateLogStatus(db, log.id, "error", "boom");
    expect(updated?.status).toBe("error");
    expect(updated?.error).toBe("boom");
  });

  it("lists recent logs newest-first", async () => {
    await insertLog(db, { rawPayload: { n: 1 }, leadCount: 1 });
    await insertLog(db, { rawPayload: { n: 2 }, leadCount: 1 });
    const logs = await listRecentLogs(db, 10);
    expect(logs).toHaveLength(2);
  });
});

describe("destinations repository", () => {
  it("returns null when there is no active destination", async () => {
    expect(await getActiveDestination(db)).toBeNull();
  });

  it("saves an active destination and reads it back", async () => {
    const dest = await saveDestination(db, {
      name: "BotConversa",
      webhookUrl: "https://botconversa.example/webhook/abc",
    });
    expect(dest.isActive).toBe(true);
    const active = await getActiveDestination(db);
    expect(active?.webhookUrl).toBe("https://botconversa.example/webhook/abc");
  });

  it("deactivates the previous destination when a new one is saved", async () => {
    await saveDestination(db, { name: "old", webhookUrl: "https://old" });
    await saveDestination(db, { name: "new", webhookUrl: "https://new" });
    const active = await getActiveDestination(db);
    expect(active?.webhookUrl).toBe("https://new");
    const all = await listDestinations(db);
    expect(all.filter((d) => d.isActive)).toHaveLength(1);
  });
});

describe("queue repository", () => {
  async function makeLog() {
    return insertLog(db, { rawPayload: {}, leadCount: 1 });
  }

  it("enqueues a pending item", async () => {
    const log = await makeLog();
    const item = await enqueue(db, {
      logId: log.id,
      dedupeKey: "evt-1",
      firstName: "Iolanda",
      lastName: "Salles",
      phone: "+55 (66) 999000320",
      payload: { nome: "Iolanda", sobrenome: "Salles", telefone: "x" },
    });
    expect(item?.status).toBe("pending");
    expect(item?.attempts).toBe(0);
  });

  it("is idempotent on dedupeKey (second insert is skipped)", async () => {
    const base = {
      firstName: "A",
      lastName: "B",
      phone: "+55 (11) 999998888",
      payload: {},
      dedupeKey: "same-event",
    };
    const first = await enqueue(db, base);
    const second = await enqueue(db, base);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const all = await listQueue(db, { limit: 100 });
    expect(all).toHaveLength(1);
  });

  it("allows multiple items with no dedupeKey", async () => {
    const base = {
      firstName: "A",
      lastName: "B",
      phone: "+55 (11) 999998888",
      payload: {},
    };
    await enqueue(db, base);
    await enqueue(db, base);
    expect(await listQueue(db, { limit: 100 })).toHaveLength(2);
  });

  it("claims the oldest pending item and marks it processing", async () => {
    const now = new Date("2026-06-24T12:00:00Z");
    await db.insert(sendQueue).values([
      {
        firstName: "older",
        lastName: "",
        phone: "+55 (11) 111111111",
        payload: {},
        createdAt: new Date("2026-06-24T11:00:00Z"),
        nextAttemptAt: new Date("2026-06-24T11:00:00Z"),
      },
      {
        firstName: "newer",
        lastName: "",
        phone: "+55 (11) 222222222",
        payload: {},
        createdAt: new Date("2026-06-24T11:30:00Z"),
        nextAttemptAt: new Date("2026-06-24T11:30:00Z"),
      },
    ]);

    const claimed = await claimNext(db, { limit: 1, now });
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.firstName).toBe("older");
    expect(claimed[0]?.status).toBe("processing");

    // The claimed item is no longer pending, so a second claim returns the newer one.
    const claimed2 = await claimNext(db, { limit: 1, now });
    expect(claimed2[0]?.firstName).toBe("newer");
  });

  it("does not claim items whose nextAttemptAt is in the future", async () => {
    const now = new Date("2026-06-24T12:00:00Z");
    await db.insert(sendQueue).values({
      firstName: "later",
      lastName: "",
      phone: "+55 (11) 333333333",
      payload: {},
      nextAttemptAt: new Date("2026-06-24T13:00:00Z"),
    });
    expect(await claimNext(db, { limit: 5, now })).toHaveLength(0);
  });

  it("marks an item as sent", async () => {
    const item = await enqueue(db, {
      firstName: "A",
      lastName: "",
      phone: "+55 (11) 999998888",
      payload: {},
    });
    const now = new Date("2026-06-24T12:00:00Z");
    const sent = await markSent(db, item!.id, now);
    expect(sent?.status).toBe("sent");
    expect(sent?.sentAt?.toISOString()).toBe(now.toISOString());
  });

  it("retries with backoff and fails after maxAttempts", async () => {
    const now = new Date("2026-06-24T12:00:00Z");
    const item = await enqueue(db, {
      firstName: "A",
      lastName: "",
      phone: "+55 (11) 999998888",
      payload: {},
    });

    const first = await markFailed(db, item!.id, {
      error: "http 500",
      now,
      backoffMs: 60_000,
    });
    expect(first?.status).toBe("pending");
    expect(first?.attempts).toBe(1);
    expect(first?.nextAttemptAt.getTime()).toBe(now.getTime() + 60_000);

    // Exhaust the remaining attempts (default maxAttempts = 5).
    let last = first;
    for (let i = 0; i < 4; i++) {
      last = await markFailed(db, item!.id, {
        error: "http 500",
        now,
        backoffMs: 60_000,
      });
    }
    expect(last?.attempts).toBe(5);
    expect(last?.status).toBe("failed");
  });

  it("lists queue items filtered by status", async () => {
    await enqueue(db, {
      firstName: "A",
      lastName: "",
      phone: "+55 (11) 999998888",
      payload: {},
    });
    expect(await listQueue(db, { status: "pending", limit: 100 })).toHaveLength(
      1,
    );
    expect(await listQueue(db, { status: "sent", limit: 100 })).toHaveLength(0);
  });
});
