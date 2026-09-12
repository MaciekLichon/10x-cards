import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));

import { GET, POST } from "@/pages/api/flashcards/collection";

const CARD_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = "2026-09-12T08:30:00+00:00";
const UPDATED_AT = "2026-09-12T09:45:12.123456+00:00";
const ROW = {
  id: CARD_ID,
  front: "Literal fixture front",
  back: "Literal fixture back",
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
};
const PUBLIC_CARD = {
  id: CARD_ID,
  front: "Literal fixture front",
  back: "Literal fixture back",
  createdAt: "2026-09-12T08:30:00Z",
  updatedAt: "2026-09-12T09:45:12.123456Z",
};

interface DatabaseResult {
  data: unknown;
  error: unknown;
  status?: number;
}

function routeContext(
  method: "GET" | "POST",
  body?: string | object,
  options: { authenticated?: boolean; contentType?: string; origin?: string; url?: string } = {},
) {
  const request = new Request(options.url ?? "http://localhost/api/flashcards/collection", {
    method,
    headers:
      method === "POST"
        ? { "Content-Type": options.contentType ?? "application/json", Origin: options.origin ?? "http://localhost" }
        : undefined,
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  return {
    request,
    url: new URL(request.url),
    locals: { user: options.authenticated === false ? null : { id: "owner" } },
    cookies: {},
  };
}

async function getCollection(options: Parameters<typeof routeContext>[2] = {}): Promise<Response> {
  return GET(routeContext("GET", undefined, options) as unknown as Parameters<typeof GET>[0]);
}

async function createCard(body: string | object, options: Parameters<typeof routeContext>[2] = {}): Promise<Response> {
  return POST(routeContext("POST", body, options) as unknown as Parameters<typeof POST>[0]);
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

function listClient(result: DatabaseResult) {
  const calls = { selected: "", orders: [] as { column: string; ascending: boolean }[], limit: 0, filter: "" };
  const query = {
    order(column: string, options: { ascending: boolean }) {
      calls.orders.push({ column, ascending: options.ascending });
      return query;
    },
    limit(value: number) {
      calls.limit = value;
      return query;
    },
    or(value: string) {
      calls.filter = value;
      return query;
    },
    then(resolve: (value: DatabaseResult) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  const select = vi.fn((fields: string) => {
    calls.selected = fields;
    return query;
  });
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, calls };
}

function createClientFake(insertResult: DatabaseResult | Error, reconciliation?: DatabaseResult) {
  const calls = { inserted: null as unknown, selected: [] as string[], ids: [] as string[] };
  const maybeSingle = vi.fn().mockResolvedValue(reconciliation);
  const readBuilder = {
    eq(column: string, value: string) {
      if (column === "id") calls.ids.push(value);
      return readBuilder;
    },
    maybeSingle,
  };
  const single = vi.fn(() =>
    insertResult instanceof Error ? Promise.reject(insertResult) : Promise.resolve(insertResult),
  );
  const insertBuilder = {
    select(fields: string) {
      calls.selected.push(fields);
      return { single };
    },
  };
  const insert = vi.fn((rows: unknown) => {
    calls.inserted = rows;
    return insertBuilder;
  });
  const select = vi.fn((fields: string) => {
    calls.selected.push(fields);
    return readBuilder;
  });
  const from = vi.fn(() => ({ insert, select }));
  return { client: { from }, from, insert, select, single, maybeSingle, calls };
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe("GET /api/flashcards/collection", () => {
  it("rejects an unauthenticated read before creating a database client", async () => {
    await expectError(await getCollection({ authenticated: false }), 401, "unauthenticated");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("maps ordered rows to public canonical DTOs and requests one look-ahead row", async () => {
    const fake = listClient({ data: [ROW], error: null });
    createClientMock.mockReturnValue(fake.client);

    const response = await getCollection();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ flashcards: [PUBLIC_CARD], nextCursor: null });
    expect(fake.calls).toEqual({
      selected: "id, front, back, created_at, updated_at",
      orders: [
        { column: "created_at", ascending: false },
        { column: "id", ascending: false },
      ],
      limit: 21,
      filter: "",
    });
  });

  it("applies the decoded cursor to the keyset pagination query", async () => {
    const fake = listClient({ data: [], error: null });
    createClientMock.mockReturnValue(fake.client);
    const cursor = btoa(JSON.stringify({ createdAt: "2026-09-12T08:30:00.000Z", id: CARD_ID }));

    const response = await getCollection({ url: `http://localhost/api/flashcards/collection?cursor=${cursor}` });

    expect(response.status).toBe(200);
    expect(fake.calls.filter).toBe(
      `created_at.lt.2026-09-12T08:30:00.000Z,and(created_at.eq.2026-09-12T08:30:00.000Z,id.lt.${CARD_ID})`,
    );
  });
});

describe("POST /api/flashcards/collection", () => {
  it.each([
    [
      "cross-origin",
      { origin: "https://attacker.example" },
      { id: CARD_ID, front: "Front", back: "Back" },
      403,
      "invalid_origin",
    ],
    [
      "unauthenticated",
      { authenticated: false },
      { id: CARD_ID, front: "Front", back: "Back" },
      401,
      "unauthenticated",
    ],
    [
      "wrong content type",
      { contentType: "text/plain" },
      { id: CARD_ID, front: "Front", back: "Back" },
      415,
      "invalid_json",
    ],
    ["malformed JSON", {}, "{", 400, "invalid_json"],
    ["invalid card", {}, { id: "invalid", front: "", back: "Back" }, 422, "invalid_flashcard"],
  ])("rejects %s before creating a database client", async (_label, options, body, status, code) => {
    await expectError(await createCard(body, options), status, code);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("discards extra keys, inserts the parsed manual row, and canonicalizes timestamps", async () => {
    const fake = createClientFake({ data: ROW, error: null, status: 201 });
    createClientMock.mockReturnValue(fake.client);

    const response = await createCard({
      id: CARD_ID.toUpperCase(),
      front: "  Literal fixture front  ",
      back: "  Literal fixture back  ",
      user_id: "spoofed-owner",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ flashcard: PUBLIC_CARD });
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.calls.inserted).toEqual({ id: CARD_ID, front: ROW.front, back: ROW.back });
  });

  it("reconciles an exact duplicate without a second insert", async () => {
    const fake = createClientFake(
      { data: null, error: { code: "23505" }, status: 409 },
      { data: ROW, error: null, status: 200 },
    );
    createClientMock.mockReturnValue(fake.client);

    const response = await createCard({ id: CARD_ID, front: ROW.front, back: ROW.back });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ flashcard: PUBLIC_CARD });
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.select).toHaveBeenCalledOnce();
    expect(fake.calls.ids).toEqual([CARD_ID]);
  });

  it("classifies a duplicate with different content as a conflict", async () => {
    const fake = createClientFake(
      { data: null, error: { code: "23505" }, status: 409 },
      { data: { ...ROW, back: "Existing different back" }, error: null, status: 200 },
    );
    createClientMock.mockReturnValue(fake.client);

    await expectError(await createCard({ id: CARD_ID, front: ROW.front, back: ROW.back }), 409, "save_conflict");
    expect(fake.insert).toHaveBeenCalledOnce();
  });

  it.each([
    ["status-zero result", { data: null, error: { message: "connection lost" }, status: 0 }],
    ["thrown transport error", new Error("connection lost")],
  ])("reconciles a %s without replaying the insert", async (_label, insertResult) => {
    const fake = createClientFake(insertResult, { data: ROW, error: null, status: 200 });
    createClientMock.mockReturnValue(fake.client);

    const response = await createCard({ id: CARD_ID, front: ROW.front, back: ROW.back });

    expect(response.status).toBe(200);
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.select).toHaveBeenCalledOnce();
  });

  it("uses reconcile mode as a read-only lookup", async () => {
    const fake = createClientFake({ data: ROW, error: null }, { data: ROW, error: null, status: 200 });
    createClientMock.mockReturnValue(fake.client);

    const response = await createCard({ id: CARD_ID, front: ROW.front, back: ROW.back, reconcile: true });

    expect(response.status).toBe(200);
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.select).toHaveBeenCalledOnce();
  });
});
