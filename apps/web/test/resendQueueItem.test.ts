import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueue,
  getQueueItemById,
  markSent,
  saveDestination,
  type Database,
} from "@renovi/db";
import { resendQueueItem } from "@/lib/handlers/resendQueueItem";
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

async function seed() {
  return enqueue(db, {
    firstName: "Iolanda",
    lastName: "Salles",
    phone: "+55 (66) 999000320",
    payload: {
      nome: "Iolanda",
      sobrenome: "Salles",
      telefone: "+55 (66) 999000320",
    },
  });
}

describe("resendQueueItem", () => {
  it("re-sends an already-sent item's payload to the active destination", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc/hook" });
    const item = await seed();
    await markSent(db, item!.id, new Date()); // já enviado antes

    const fetchFn = okFetch();
    const result = await resendQueueItem({ db, fetchFn, id: item!.id });

    expect(result).toMatchObject({ ok: true, status: "sent" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://bc/hook");
    expect(JSON.parse(init?.body as string)).toEqual({
      nome: "Iolanda",
      sobrenome: "Salles",
      telefone: "+55 (66) 999000320",
    });
  });

  it("returns no_destination when none is configured", async () => {
    const item = await seed();
    const fetchFn = okFetch();
    const result = await resendQueueItem({ db, fetchFn, id: item!.id });
    expect(result).toMatchObject({ ok: false, reason: "no_destination" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown id", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc/hook" });
    const fetchFn = okFetch();
    const result = await resendQueueItem({
      db,
      fetchFn,
      id: "00000000-0000-0000-0000-000000000000",
    });
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("marks the item failed on a non-2xx response", async () => {
    await saveDestination(db, { name: "bc", webhookUrl: "https://bc/hook" });
    const item = await seed();
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("nope", { status: 500 }),
    );

    const result = await resendQueueItem({
      db,
      fetchFn,
      id: item!.id,
      backoffMs: 1000,
    });

    expect(result.ok).toBe(false);
    const found = await getQueueItemById(db, item!.id);
    expect(found?.attempts).toBe(1);
    expect(found?.lastError).toContain("500");
  });
});
