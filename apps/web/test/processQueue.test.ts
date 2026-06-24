import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueue,
  listQueue,
  saveDestination,
  sendQueue,
  type Database,
} from "@renovi/db";
import {
  processQueueTick,
  runProcessLoop,
} from "@/lib/handlers/processQueue";
import { createTestDb } from "./helpers/testDb";

let db: Database;

beforeEach(async () => {
  ({ db } = await createTestDb());
});

function okFetch() {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response("ok", { status: 200 }),
  );
}

async function seedPending(over: Partial<Parameters<typeof enqueue>[1]> = {}) {
  return enqueue(db, {
    firstName: "Iolanda",
    lastName: "Salles",
    phone: "+55 (66) 999000320",
    payload: { nome: "Iolanda", sobrenome: "Salles", telefone: "+55 (66) 999000320" },
    ...over,
  });
}

describe("processQueueTick", () => {
  it("posts the payload to the active destination and marks the item sent", async () => {
    await saveDestination(db, {
      name: "BotConversa",
      webhookUrl: "https://botconversa.example/webhook/abc",
    });
    await seedPending();
    const fetchFn = okFetch();

    const result = await processQueueTick({ db, fetchFn });

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://botconversa.example/webhook/abc");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      nome: "Iolanda",
      sobrenome: "Salles",
      telefone: "+55 (66) 999000320",
    });

    const sent = await listQueue(db, { status: "sent", limit: 10 });
    expect(sent).toHaveLength(1);
  });

  it("does nothing and reports noDestination when none is configured", async () => {
    await seedPending();
    const fetchFn = okFetch();

    const result = await processQueueTick({ db, fetchFn });

    expect(result.noDestination).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    // Item must remain pending (not claimed).
    expect(await listQueue(db, { status: "pending", limit: 10 })).toHaveLength(1);
  });

  it("marks the item failed (back to pending with backoff) on a non-2xx response", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc" });
    await seedPending();
    const fetchFn = vi.fn(async () => new Response("nope", { status: 500 }));

    const result = await processQueueTick({ db, fetchFn, backoffMs: 30_000 });

    expect(result).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
    const pending = await listQueue(db, { status: "pending", limit: 10 });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.lastError).toContain("500");
  });

  it("marks the item failed when fetch throws", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc" });
    await seedPending();
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    });

    const result = await processQueueTick({ db, fetchFn });
    expect(result.failed).toBe(1);
    expect(await listQueue(db, { status: "pending", limit: 10 })).toHaveLength(1);
  });
});

describe("runProcessLoop", () => {
  it("drains multiple items across ticks until the deadline", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc" });
    // Seed 3 items eligible in the past relative to the fake clock.
    const past = new Date("2026-06-24T11:00:00Z");
    await db.insert(sendQueue).values(
      [0, 1, 2].map((i) => ({
        firstName: `Lead${i}`,
        lastName: "",
        phone: "+55 (11) 999998888",
        payload: { nome: `Lead${i}` },
        nextAttemptAt: past,
        createdAt: new Date(past.getTime() + i * 1000),
      })),
    );
    const fetchFn = okFetch();

    // Fake clock starting at a fixed epoch; sleep advances it.
    let t = Date.parse("2026-06-24T12:00:00Z");
    const clock = () => t;
    const sleep = vi.fn(async (ms: number) => {
      t += ms;
    });

    const result = await runProcessLoop({
      db,
      fetchFn,
      tickMs: 5_000,
      maxRuntimeMs: 16_000,
      batchSize: 1,
      clock,
      sleep,
    });

    expect(result.sent).toBe(3);
    expect(result.ticks).toBeGreaterThanOrEqual(3);
    expect(await listQueue(db, { status: "sent", limit: 10 })).toHaveLength(3);
  });
});
