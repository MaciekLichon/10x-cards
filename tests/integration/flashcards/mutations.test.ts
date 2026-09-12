import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ createClient: createClientMock }));

import { DELETE, PATCH } from "@/pages/api/flashcards/[id]";

const TARGET_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";
const OLD_VERSION = "2026-09-12T08:30:00Z";
const ROW = {
  id: TARGET_ID,
  front: "Updated target front",
  back: "Updated target back",
  created_at: "2026-09-10T07:00:00+00:00",
  updated_at: "2026-09-12T09:45:12.123456+00:00",
};

type Handler = typeof PATCH;
interface DatabaseResult {
  data: unknown;
  error: unknown;
  status?: number;
}

function mutationRequest(
  handler: Handler,
  body: string | object,
  options: {
    authenticated?: boolean;
    contentType?: string;
    origin?: string;
    pathId?: string;
  } = {},
): Promise<Response> {
  const pathId = options.pathId ?? TARGET_ID;
  const method = handler === PATCH ? "PATCH" : "DELETE";
  const request = new Request(`http://localhost/api/flashcards/${pathId}`, {
    method,
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
    params: { id: pathId },
  } as unknown as Parameters<Handler>[0];
  return handler(context);
}

function patchBody(id = TARGET_ID) {
  return { id, front: ROW.front, back: ROW.back, updatedAt: OLD_VERSION };
}

function deleteBody(id = TARGET_ID) {
  return { id, updatedAt: OLD_VERSION };
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({ error: { code } });
}

function mutationClient(kind: "update" | "delete", result: DatabaseResult, classification?: DatabaseResult | Error) {
  const calls = {
    update: null as unknown,
    predicates: [] as { column: string; value: string }[],
    selected: [] as string[],
  };
  const mutationBuilder = {
    eq(column: string, value: string) {
      calls.predicates.push({ column, value });
      return mutationBuilder;
    },
    select(fields: string) {
      calls.selected.push(fields);
      return Promise.resolve(result);
    },
  };
  const update = vi.fn((value: unknown) => {
    calls.update = value;
    return mutationBuilder;
  });
  const remove = vi.fn(() => mutationBuilder);

  const maybeSingle = vi.fn(() =>
    classification instanceof Error ? Promise.reject(classification) : Promise.resolve(classification),
  );
  const classificationBuilder = {
    eq(column: string, value: string) {
      calls.predicates.push({ column, value });
      return classificationBuilder;
    },
    maybeSingle,
  };
  const classificationSelect = vi.fn((fields: string) => {
    calls.selected.push(fields);
    return classificationBuilder;
  });
  let fromCount = 0;
  const from = vi.fn(() => {
    fromCount += 1;
    if (fromCount === 1) return kind === "update" ? { update } : { delete: remove };
    return { select: classificationSelect };
  });
  return { client: { from }, from, update, remove, classificationSelect, maybeSingle, calls };
}

beforeEach(() => {
  createClientMock.mockReset();
});

describe.each([
  ["PATCH", PATCH, patchBody],
  ["DELETE", DELETE, deleteBody],
] as const)("%s /api/flashcards/[id] validation", (_method, handler, body) => {
  it.each([
    ["cross-origin", { origin: "https://attacker.example" }, body(), 403, "invalid_origin"],
    ["unauthenticated", { authenticated: false }, body(), 401, "unauthenticated"],
    ["invalid path id", { pathId: "invalid" }, body(), 400, "invalid_flashcard_id"],
    ["wrong content type", { contentType: "text/plain" }, body(), 415, "invalid_json"],
    ["malformed JSON", {}, "{", 400, "invalid_json"],
    ["path/body mismatch", {}, body(OTHER_ID), 400, "invalid_flashcard_id"],
  ])("rejects %s before creating a database client", async (_label, options, requestBody, status, code) => {
    await expectError(await mutationRequest(handler, requestBody, options), status, code);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/flashcards/[id]", () => {
  it("targets the exact id/version and returns the canonical public target", async () => {
    const fake = mutationClient("update", { data: [ROW], error: null, status: 200 });
    createClientMock.mockReturnValue(fake.client);

    const response = await mutationRequest(PATCH, patchBody());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      flashcard: {
        id: TARGET_ID,
        front: ROW.front,
        back: ROW.back,
        createdAt: "2026-09-10T07:00:00Z",
        updatedAt: "2026-09-12T09:45:12.123456Z",
      },
    });
    expect(fake.update).toHaveBeenCalledWith({ front: ROW.front, back: ROW.back });
    expect(fake.calls.predicates).toEqual([
      { column: "id", value: TARGET_ID },
      { column: "updated_at", value: OLD_VERSION },
    ]);
    expect(fake.calls.selected).toEqual(["id, front, back, created_at, updated_at"]);
  });
});

describe("DELETE /api/flashcards/[id]", () => {
  it("targets the exact id/version and returns only the deleted target id", async () => {
    const fake = mutationClient("delete", { data: [{ id: TARGET_ID }], error: null, status: 200 });
    createClientMock.mockReturnValue(fake.client);

    const response = await mutationRequest(DELETE, deleteBody());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedId: TARGET_ID });
    expect(fake.remove).toHaveBeenCalledOnce();
    expect(fake.calls.predicates).toEqual([
      { column: "id", value: TARGET_ID },
      { column: "updated_at", value: OLD_VERSION },
    ]);
    expect(fake.calls.selected).toEqual(["id"]);
  });
});

describe.each([
  ["PATCH", PATCH, patchBody, "update"],
  ["DELETE", DELETE, deleteBody, "delete"],
] as const)("%s /api/flashcards/[id] zero-row classification", (_method, handler, body, kind) => {
  // These direct-handler tests prove non-disclosing envelopes, not database RLS enforcement.
  it("classifies an owner-visible target as a stale-version conflict", async () => {
    const fake = mutationClient(
      kind,
      { data: [], error: null, status: 200 },
      {
        data: { id: TARGET_ID, updated_at: ROW.updated_at },
        error: null,
        status: 200,
      },
    );
    createClientMock.mockReturnValue(fake.client);

    await expectError(await mutationRequest(handler, body()), 409, "mutation_conflict");
    expect(fake.classificationSelect).toHaveBeenCalledWith("id, updated_at");
    expect(fake.calls.predicates.at(-1)).toEqual({ column: "id", value: TARGET_ID });
  });

  it.each(["missing target", "cross-owner target hidden by RLS"])(
    "returns the same generic not-found envelope for a %s",
    async () => {
      const fake = mutationClient(
        kind,
        { data: [], error: null, status: 200 },
        {
          data: null,
          error: null,
          status: 200,
        },
      );
      createClientMock.mockReturnValue(fake.client);

      const response = await mutationRequest(handler, body());
      const responseCopy = response.clone();

      await expectError(response, 404, "flashcard_not_found");
      await expect(responseCopy.json()).resolves.not.toHaveProperty("flashcard");
    },
  );

  it.each([
    ["classification error", { data: null, error: { message: "read failed" }, status: 500 }],
    ["status-zero classification", { data: null, error: null, status: 0 }],
    ["thrown classification", new Error("read failed")],
  ])("reports an ambiguous mutation when the %s cannot confirm visibility", async (_label, classification) => {
    const fake = mutationClient(kind, { data: [], error: null, status: 200 }, classification);
    createClientMock.mockReturnValue(fake.client);

    await expectError(await mutationRequest(handler, body()), 503, "mutation_ambiguous");
    expect(kind === "update" ? fake.update : fake.remove).toHaveBeenCalledOnce();
  });
});
