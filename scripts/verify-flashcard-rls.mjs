import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import process, { loadEnvFile } from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env", ".dev.vars"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY must be configured for the local Supabase stack.");
}

const configuredUrl = new URL(supabaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(configuredUrl.hostname)) {
  throw new Error("Refusing to run against a non-local Supabase URL. Use a resettable local stack.");
}

const localConfig = readFileSync("supabase/config.toml", "utf8");
const inbucketSection = localConfig.match(/\[inbucket\]([\s\S]*?)(?:\n\[|$)/)?.[1];
const inbucketPort = inbucketSection?.match(/^port\s*=\s*(\d+)\s*$/m)?.[1];
if (!inbucketPort) {
  throw new Error("Local Mailpit port is missing from supabase/config.toml.");
}
const mailpitUrl = new URL(`http://${configuredUrl.hostname}:${inbucketPort}`);

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

const ownerClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const otherClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const anonymousClient = createClient(supabaseUrl, supabaseKey, clientOptions);
const runId = `${Date.now()}-${randomUUID()}`;
const password = `Local-only-${randomUUID()}-Aa1!`;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  pass(message);
}

async function createAuthenticatedUser(client, label) {
  const email = `flashcard-rls-${label}-${runId}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password });

  assert(!error, `${label} user signs up through the ordinary client`);
  assert(Boolean(data.user?.id), `${label} user has a pending local identity`);

  let token;
  for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
    const searchUrl = new URL("/api/v1/search", mailpitUrl);
    searchUrl.searchParams.set("query", `to:${email}`);
    searchUrl.searchParams.set("limit", "1");
    const searchResponse = await globalThis.fetch(searchUrl);
    if (searchResponse.ok) {
      const search = await searchResponse.json();
      const messageId = search.messages?.[0]?.ID;
      if (messageId) {
        const messageResponse = await globalThis.fetch(new URL(`/api/v1/message/${messageId}`, mailpitUrl));
        if (messageResponse.ok) {
          const message = await messageResponse.json();
          token = message.Text?.match(/enter the code:\s*(\d+)/i)?.[1];
        }
      }
    }
    if (!token) await delay(250);
  }
  assert(Boolean(token), `${label} user's confirmation reaches local Mailpit`);

  const { data: verified, error: verificationError } = await client.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });
  assert(!verificationError && Boolean(verified.session), `${label} user confirms through the ordinary client`);
  assert(verified.user?.id === data.user.id, `${label} user receives the expected authenticated identity`);

  return verified.user.id;
}

async function main() {
  console.log("Verifying flashcard RLS against the local Supabase API...");

  const ownerId = await createAuthenticatedUser(ownerClient, "owner");
  await createAuthenticatedUser(otherClient, "other");

  const { data: insertedCard, error: insertError } = await ownerClient
    .from("flashcards")
    .insert({ front: "RLS owner question", back: "RLS owner answer" })
    .select()
    .single();
  assert(!insertError && insertedCard?.user_id === ownerId, "owner inserts a card with database-assigned ownership");

  const { data: ownerCards, error: ownerSelectError } = await ownerClient
    .from("flashcards")
    .select("id, user_id")
    .eq("id", insertedCard.id);
  assert(!ownerSelectError && ownerCards.length === 1, "owner selects their card");

  const { data: otherCards, error: otherSelectError } = await otherClient
    .from("flashcards")
    .select("id")
    .eq("id", insertedCard.id);
  assert(!otherSelectError && otherCards.length === 0, "second user cannot select the owner's card");

  const { data: otherUpdated, error: otherUpdateError } = await otherClient
    .from("flashcards")
    .update({ front: "Cross-account update" })
    .eq("id", insertedCard.id)
    .select("id");
  assert(!otherUpdateError && otherUpdated.length === 0, "second user cannot update the owner's card");

  const { data: otherDeleted, error: otherDeleteError } = await otherClient
    .from("flashcards")
    .delete()
    .eq("id", insertedCard.id)
    .select("id");
  assert(!otherDeleteError && otherDeleted.length === 0, "second user cannot delete the owner's card");

  const { error: spoofedInsertError } = await otherClient
    .from("flashcards")
    .insert({ user_id: ownerId, front: "Spoofed owner", back: "Must be rejected" });
  assert(Boolean(spoofedInsertError), "second user cannot insert a card owned by the first user");

  const { data: anonymousCards, error: anonymousSelectError } = await anonymousClient
    .from("flashcards")
    .select("id")
    .eq("id", insertedCard.id);
  assert(!anonymousSelectError && anonymousCards.length === 0, "anonymous client cannot select the owner's card");

  const { error: anonymousInsertError } = await anonymousClient
    .from("flashcards")
    .insert({ front: "Anonymous question", back: "Must be rejected" });
  assert(Boolean(anonymousInsertError), "anonymous client cannot insert a card");

  const { data: updatedCard, error: ownerUpdateError } = await ownerClient
    .from("flashcards")
    .update({ front: "RLS owner question updated" })
    .eq("id", insertedCard.id)
    .select("id, front")
    .single();
  assert(!ownerUpdateError && updatedCard?.front === "RLS owner question updated", "owner updates their card");

  const { data: deletedCard, error: ownerDeleteError } = await ownerClient
    .from("flashcards")
    .delete()
    .eq("id", insertedCard.id)
    .select("id")
    .single();
  assert(!ownerDeleteError && deletedCard?.id === insertedCard.id, "owner deletes their card");

  console.log("Flashcard RLS verification passed. Run `npm run db:reset` to remove transient test users.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Flashcard RLS verification failed.");
  process.exitCode = 1;
});
