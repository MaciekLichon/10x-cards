import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));

import { POST } from "@/pages/api/flashcards/save";

const FIRST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSALS = [
  { id: FIRST_ID, question: "Edited first question?", answer: "Edited first answer." },
  { id: SECOND_ID, question: "Second selected question?", answer: "Second selected answer." },
];
const ROWS = [
  { id: FIRST_ID, front: "Edited first question?", back: "Edited first answer." },
  { id: SECOND_ID, front: "Second selected question?", back: "Second selected answer." },
];

interface DatabaseResult {
  data: unknown;
  error: unknown;
  status?: number;
}

async function saveRequest(
  body: string | object = { proposals: PROPOSALS },
  options: { authenticated?: boolean; contentType?: string; origin?: string } = {},
): Promise<Response> {
  const request = new Request("http://localhost/api/flashcards/save", {
    method: "POST",
    headers: {
      "Content-Type": options.contentType ?? "application/json",
      Origin: options.origin ?? "http://localhost",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const context = {
    request,
    locals: { user: options.authenticated === false ? null : { id: "owner" } },
    cookies: {},
  } as unknown as Parameters<typeof POST>[0];
  return POST(context);
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

function insertClient(result: DatabaseResult | Error) {
  const insert = vi.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)));
  const from = vi.fn(() => ({ insert }));
  return { client: { from }, from, insert };
}

function readClient(result: DatabaseResult) {
  const inIds = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ in: inIds }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, select, inIds };
}

function ambiguousInsertClient(insertResult: DatabaseResult | Error, readResult: DatabaseResult) {
  const insert = vi.fn(() =>
    insertResult instanceof Error ? Promise.reject(insertResult) : Promise.resolve(insertResult),
  );
  const inIds = vi.fn().mockResolvedValue(readResult);
  const select = vi.fn(() => ({ in: inIds }));
  const from = vi.fn(() => ({ insert, select }));
  return { client: { from }, from, insert, select, inIds };
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe("POST /api/flashcards/save", () => {
  it.each([
    ["cross-origin", { origin: "https://attacker.example" }, { proposals: PROPOSALS }, 403, "invalid_origin"],
    ["unauthenticated", { authenticated: false }, { proposals: PROPOSALS }, 401, "unauthenticated"],
    ["wrong content type", { contentType: "text/plain" }, { proposals: PROPOSALS }, 415, "invalid_json"],
    ["malformed JSON", {}, "{", 400, "invalid_json"],
    ["invalid proposals", {}, { proposals: [] }, 422, "invalid_proposals"],
  ])("rejects %s before creating a database client", async (_label, options, body, status, code) => {
    await expectError(await saveRequest(body, options), status, code);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("performs one insert containing only the parsed id/front/back rows", async () => {
    const fake = insertClient({ data: null, error: null, status: 201 });
    createClientMock.mockReturnValue(fake.client);

    const response = await saveRequest({
      proposals: PROPOSALS.map((proposal) => ({ ...proposal, user_id: "spoofed-owner", ignored: true })),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ savedCount: 2 });
    expect(fake.from).toHaveBeenCalledOnce();
    expect(fake.from).toHaveBeenCalledWith("flashcards");
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.insert).toHaveBeenCalledWith(ROWS);
  });

  it("uses reconcile mode as a read-only exact-set check", async () => {
    const fake = readClient({ data: ROWS, error: null });
    createClientMock.mockReturnValue(fake.client);

    const response = await saveRequest({ proposals: PROPOSALS, reconcile: true });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ savedCount: 2 });
    expect(fake.select).toHaveBeenCalledWith("id, front, back");
    expect(fake.inIds).toHaveBeenCalledWith("id", [FIRST_ID, SECOND_ID]);
    expect(fake.client).not.toHaveProperty("insert");
  });

  it.each([
    ["empty", [], 503, "save_failed"],
    ["partial", [ROWS[0]], 409, "save_conflict"],
    ["content-mismatched", [{ ...ROWS[0], back: "Different." }, ROWS[1]], 409, "save_conflict"],
  ])("classifies a %s reconciliation result", async (_label, data, status, code) => {
    const fake = readClient({ data, error: null });
    createClientMock.mockReturnValue(fake.client);

    await expectError(await saveRequest({ proposals: PROPOSALS, reconcile: true }), status, code);
    expect(fake.inIds).toHaveBeenCalledOnce();
  });

  it("reports an unreadable reconciliation as ambiguous", async () => {
    const fake = readClient({ data: null, error: { message: "read failed" } });
    createClientMock.mockReturnValue(fake.client);

    await expectError(await saveRequest({ proposals: PROPOSALS, reconcile: true }), 503, "save_ambiguous");
  });

  it.each([
    ["status-zero result", { data: null, error: { message: "connection lost" }, status: 0 }],
    ["thrown transport error", new Error("connection lost")],
  ])("reconciles a %s without replaying the insert", async (_label, insertResult) => {
    const fake = ambiguousInsertClient(insertResult, { data: ROWS, error: null });
    createClientMock.mockReturnValue(fake.client);

    const response = await saveRequest();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ savedCount: 2 });
    expect(fake.insert).toHaveBeenCalledOnce();
    expect(fake.select).toHaveBeenCalledOnce();
    expect(fake.inIds).toHaveBeenCalledOnce();
  });
});
