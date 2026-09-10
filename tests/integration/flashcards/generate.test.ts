import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/pages/api/flashcards/generate";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const VALID_SOURCE = "s".repeat(1_000);

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

interface SuccessBody {
  proposals: { question: string; answer: string }[];
  sparse: boolean;
}

function providerEnvelope(content: unknown): Response {
  return Response.json({ choices: [{ message: { content } }] });
}

function proposalContent(proposals: unknown[]): string {
  return JSON.stringify({ proposals });
}

function stubProvider(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>((input) => {
    expect(input).toBe(OPENROUTER_URL);
    return Promise.resolve(response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubProviderFailure(error: Error): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>((input) => {
    expect(input).toBe(OPENROUTER_URL);
    return Promise.reject(error);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function generate(sourceText = VALID_SOURCE): Promise<Response> {
  const request = new Request("http://localhost/api/flashcards/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
    },
    body: JSON.stringify({ sourceText }),
  });

  // The route reads only request and authenticated locals; this assertion deliberately marks the Astro runtime seam.
  const context = { request, locals: { user: { id: "test-user" } } } as unknown as Parameters<typeof POST>[0];
  return POST(context);
}

async function readBody<T>(response: Response): Promise<T> {
  const body: unknown = JSON.parse(await response.text());
  return body as T;
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  const body = await readBody<ErrorBody>(response);
  expect(body.error.code).toBe(code);
  expect(body).not.toHaveProperty("proposals");
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/flashcards/generate", () => {
  it("maps invalid provider JSON to malformed_output", async () => {
    stubProvider(new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } }));

    await expectError(await generate(), 502, "malformed_output");
  });

  it.each([
    ["empty choices", { choices: [] }],
    ["non-string content", { choices: [{ message: { content: 42 } }] }],
  ])("maps a malformed provider envelope (%s) to malformed_output", async (_label, envelope) => {
    stubProvider(Response.json(envelope));

    await expectError(await generate(), 502, "malformed_output");
  });

  it("maps non-JSON provider content to malformed_output", async () => {
    stubProvider(providerEnvelope("not-json"));

    await expectError(await generate(), 502, "malformed_output");
  });

  it.each([
    ["null output", "null"],
    ["non-array proposals", JSON.stringify({ proposals: {} })],
    ["empty proposals", proposalContent([])],
    ["only unusable candidates", proposalContent([null, {}, { question: "", answer: "answer" }])],
  ])("maps readable but unusable output (%s) to no_usable_proposals", async (_label, content) => {
    stubProvider(providerEnvelope(content));

    await expectError(await generate(), 422, "no_usable_proposals");
  });

  it("keeps only valid mixed candidates in input order", async () => {
    const expected = [
      { question: "First valid question?", answer: "First valid answer." },
      { question: "Second valid question?", answer: "Second valid answer." },
    ];
    stubProvider(
      providerEnvelope(
        proposalContent([
          null,
          {},
          { question: "", answer: "empty question" },
          { question: "q".repeat(201), answer: "too long" },
          { question: "too long answer", answer: "a".repeat(501) },
          { question: `  ${expected[0].question}  `, answer: `  ${expected[0].answer}  ` },
          { question: expected[1].question, answer: expected[1].answer },
        ]),
      ),
    );

    const response = await generate();
    const body = await readBody<SuccessBody>(response);

    expect(response.status).toBe(200);
    expect(body.proposals).toEqual(expected);
  });

  it("keeps the first valid normalized duplicate", async () => {
    stubProvider(
      providerEnvelope(
        proposalContent([
          { question: "What Is Café?", answer: "First answer." },
          { question: "ｗｈａｔ is café!!!", answer: "Duplicate answer." },
          { question: "Another question?", answer: "Another answer." },
        ]),
      ),
    );

    const body = await readBody<SuccessBody>(await generate());

    expect(body.proposals).toEqual([
      { question: "What Is Café?", answer: "First answer." },
      { question: "Another question?", answer: "Another answer." },
    ]);
  });

  it("does not let an invalid candidate reserve a normalized question", async () => {
    stubProvider(
      providerEnvelope(
        proposalContent([
          { question: "Reusable question?", answer: "" },
          { question: "reusable question!!!", answer: "Valid later answer." },
        ]),
      ),
    );

    const body = await readBody<SuccessBody>(await generate());

    expect(body.proposals).toEqual([{ question: "reusable question!!!", answer: "Valid later answer." }]);
  });

  it.each([
    [1, true],
    [4, true],
    [5, false],
  ])("returns %i cards successfully with sparse=%s", async (count, sparse) => {
    const proposals = Array.from({ length: count }, (_, index) => ({
      question: `Question ${index + 1}?`,
      answer: `Answer ${index + 1}.`,
    }));
    stubProvider(providerEnvelope(proposalContent(proposals)));

    const response = await generate();
    const body = await readBody<SuccessBody>(response);

    expect(response.status).toBe(200);
    expect(body.proposals).toEqual(proposals);
    expect(body.sparse).toBe(sparse);
  });

  it("keeps the first 15 unique cards and does not spend the limit on a duplicate", async () => {
    const unique = Array.from({ length: 16 }, (_, index) => ({
      question: `Boundary question ${index + 1}?`,
      answer: `Boundary answer ${index + 1}.`,
    }));
    const candidates = [...unique.slice(0, 14), { ...unique[0], answer: "Duplicate." }, ...unique.slice(14)];
    stubProvider(providerEnvelope(proposalContent(candidates)));

    const body = await readBody<SuccessBody>(await generate());

    expect(body.proposals).toEqual(unique.slice(0, 15));
  });

  it("accepts inclusive card length limits and filters candidates above them", async () => {
    const accepted = { question: "q".repeat(200), answer: "a".repeat(500) };
    stubProvider(
      providerEnvelope(
        proposalContent([
          { question: ` ${accepted.question} `, answer: ` ${accepted.answer} ` },
          { question: "q".repeat(201), answer: "answer" },
          { question: "question", answer: "a".repeat(501) },
        ]),
      ),
    );

    const body = await readBody<SuccessBody>(await generate());

    expect(body.proposals).toEqual([accepted]);
  });

  it.each([
    [999, 422, false],
    [1_000, 200, true],
    [10_000, 200, true],
    [10_001, 422, false],
  ])("enforces a trimmed source length of %i", async (length, status, callsProvider) => {
    const sourceText = "x".repeat(length);
    const fetchMock = stubProvider(providerEnvelope(proposalContent([{ question: "Question?", answer: "Answer." }])));

    const response = await generate(`  ${sourceText}  `);

    expect(response.status).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(callsProvider ? 1 : 0);
    if (callsProvider) {
      const [, init] = fetchMock.mock.calls[0];
      if (typeof init?.body !== "string") throw new Error("Expected the provider request body to be JSON text");
      const requestBody: unknown = JSON.parse(init.body);
      const messages = (requestBody as { messages: { role: string; content: string }[] }).messages;
      expect(messages).toContainEqual({ role: "user", content: sourceText });
    }
  });

  it.each(["TimeoutError", "AbortError"])("maps %s fetch rejection to provider_timeout", async (name) => {
    const error = new Error("controlled timeout");
    error.name = name;
    stubProviderFailure(error);

    await expectError(await generate(), 504, "provider_timeout");
  });

  it("maps another transport rejection to provider_failure", async () => {
    stubProviderFailure(new Error("controlled transport failure"));

    await expectError(await generate(), 502, "provider_failure");
  });

  it("maps a provider 500 response to provider_failure", async () => {
    stubProvider(new Response(null, { status: 500 }));

    await expectError(await generate(), 502, "provider_failure");
  });
});
