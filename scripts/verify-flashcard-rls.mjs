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
const snapshotColumns = [
  "id",
  "user_id",
  "front",
  "back",
  "created_at",
  "updated_at",
  "due",
  "stability",
  "difficulty",
  "elapsed_days",
  "scheduled_days",
  "learning_steps",
  "reps",
  "lapses",
  "state",
  "last_review",
  "schedule_version",
  "scheduler_version",
  "config_version",
].join(", ");

const fixtures = {
  target: {
    id: "10000000-0000-4000-8000-000000000001",
    front: "Target question",
    back: "Target answer",
  },
  decoy: {
    id: "10000000-0000-4000-8000-000000000002",
    front: "Decoy question",
    back: "Decoy answer",
  },
  approved: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      front: "Approved question one",
      back: "Approved answer one",
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      front: "Approved question two",
      back: "Approved answer two",
    },
  ],
  sentinelId: "20000000-0000-4000-8000-000000000099",
  atomicNovel: {
    id: "30000000-0000-4000-8000-000000000001",
    front: "Atomic novel question",
    back: "Atomic novel answer",
  },
};

function pass(message) {
  console.log(`PASS: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  pass(message);
}

function assertJsonEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

async function ownerSnapshot() {
  const { data, error } = await ownerClient.from("flashcards").select(snapshotColumns).order("id");
  assert(!error, "owner snapshot reads all durable flashcard columns");
  return data;
}

async function assertOwnerSnapshotUnchanged(before, message) {
  const after = await ownerSnapshot();
  assertJsonEqual(after, before, message);
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
  console.log("Prerequisite: use an isolated local stack reset with `npm run db:reset` before this verifier.");

  const ownerId = await createAuthenticatedUser(ownerClient, "owner");
  const otherId = await createAuthenticatedUser(otherClient, "other");

  const { data: insertedCards, error: insertError } = await ownerClient
    .from("flashcards")
    .insert([fixtures.target, fixtures.decoy])
    .select(snapshotColumns)
    .order("id");
  assert(
    !insertError && insertedCards?.length === 2 && insertedCards.every((card) => card.user_id === ownerId),
    `owner inserts deterministic target and decoy cards with database-assigned ownership${insertError ? ` (${insertError.message})` : ""}`,
  );

  const targetBefore = insertedCards.find((card) => card.id === fixtures.target.id);
  const decoyBefore = insertedCards.find((card) => card.id === fixtures.decoy.id);
  assert(Boolean(targetBefore && decoyBefore), "target and decoy fixtures are independently identifiable by stable ID");

  const { data: ownerCards, error: ownerSelectError } = await ownerClient
    .from("flashcards")
    .select("id, user_id")
    .eq("id", fixtures.target.id);
  assert(!ownerSelectError && ownerCards.length === 1, "owner selects their card");

  const { data: otherCards, error: otherSelectError } = await otherClient
    .from("flashcards")
    .select("id")
    .eq("id", fixtures.target.id);
  assert(!otherSelectError && otherCards.length === 0, "second user cannot select the owner's card");

  let beforeDeniedWrite = await ownerSnapshot();
  const { data: otherUpdated, error: otherUpdateError } = await otherClient
    .from("flashcards")
    .update({ front: "Cross-account update" })
    .eq("id", fixtures.target.id)
    .select("id");
  assert(!otherUpdateError && otherUpdated.length === 0, "second user cannot update the owner's card");
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "cross-account update leaves the complete owner state unchanged",
  );

  beforeDeniedWrite = await ownerSnapshot();
  const { data: otherDeleted, error: otherDeleteError } = await otherClient
    .from("flashcards")
    .delete()
    .eq("id", fixtures.target.id)
    .select("id");
  assert(!otherDeleteError && otherDeleted.length === 0, "second user cannot delete the owner's card");
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "cross-account delete leaves the complete owner state unchanged",
  );

  beforeDeniedWrite = await ownerSnapshot();
  const { error: spoofedInsertError } = await otherClient
    .from("flashcards")
    .insert({ user_id: ownerId, front: "Spoofed owner", back: "Must be rejected" });
  assert(Boolean(spoofedInsertError), "second user cannot insert a card owned by the first user");
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "spoofed ownership insert leaves the complete owner state unchanged",
  );

  const { data: anonymousCards, error: anonymousSelectError } = await anonymousClient
    .from("flashcards")
    .select("id")
    .eq("id", fixtures.target.id);
  assert(!anonymousSelectError && anonymousCards.length === 0, "anonymous client cannot select the owner's card");

  beforeDeniedWrite = await ownerSnapshot();
  const { error: anonymousInsertError } = await anonymousClient
    .from("flashcards")
    .insert({ front: "Anonymous question", back: "Must be rejected" });
  assert(Boolean(anonymousInsertError), "anonymous client cannot insert a card");
  await assertOwnerSnapshotUnchanged(beforeDeniedWrite, "anonymous insert leaves the complete owner state unchanged");

  beforeDeniedWrite = await ownerSnapshot();
  const { data: anonymousUpdated, error: anonymousUpdateError } = await anonymousClient
    .from("flashcards")
    .update({ front: "Anonymous update" })
    .eq("id", fixtures.target.id)
    .select("id");
  assert(!anonymousUpdateError && anonymousUpdated.length === 0, "anonymous client cannot update the owner's card");
  await assertOwnerSnapshotUnchanged(beforeDeniedWrite, "anonymous update leaves the complete owner state unchanged");

  beforeDeniedWrite = await ownerSnapshot();
  const { data: anonymousDeleted, error: anonymousDeleteError } = await anonymousClient
    .from("flashcards")
    .delete()
    .eq("id", fixtures.target.id)
    .select("id");
  assert(!anonymousDeleteError && anonymousDeleted.length === 0, "anonymous client cannot delete the owner's card");
  await assertOwnerSnapshotUnchanged(beforeDeniedWrite, "anonymous delete leaves the complete owner state unchanged");

  beforeDeniedWrite = await ownerSnapshot();
  const { error: transferError } = await ownerClient
    .from("flashcards")
    .update({ user_id: otherId })
    .eq("id", fixtures.target.id);
  assert(Boolean(transferError), "owner cannot transfer a card to another user through the ordinary client");
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "denied ownership transfer leaves the complete owner state unchanged",
  );

  const beforeOwnerUpdate = await ownerSnapshot();
  const { data: updatedCard, error: ownerUpdateError } = await ownerClient
    .from("flashcards")
    .update({ front: "Target question updated", back: "Target answer updated" })
    .eq("id", fixtures.target.id)
    .eq("updated_at", targetBefore.updated_at)
    .select(snapshotColumns)
    .single();
  assert(
    !ownerUpdateError &&
      updatedCard?.front === "Target question updated" &&
      updatedCard.back === "Target answer updated",
    "owner edits the target card's front and back",
  );
  assert(updatedCard.updated_at !== targetBefore.updated_at, "owner content edit advances the card version");
  const expectedAfterOwnerUpdate = beforeOwnerUpdate.map((card) =>
    card.id === fixtures.target.id
      ? { ...card, front: updatedCard.front, back: updatedCard.back, updated_at: updatedCard.updated_at }
      : card,
  );
  assertJsonEqual(
    await ownerSnapshot(),
    expectedAfterOwnerUpdate,
    "owner edit changes only target content and its content version",
  );

  beforeDeniedWrite = await ownerSnapshot();
  const { error: schedulerUpdateError } = await ownerClient
    .from("flashcards")
    .update({ due: new Date(0).toISOString() })
    .eq("id", fixtures.target.id);
  assert(Boolean(schedulerUpdateError), "owner cannot update scheduler columns through the ordinary client");
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "denied scheduler update leaves the complete owner state unchanged",
  );

  beforeDeniedWrite = await ownerSnapshot();
  const { data: staleUpdated, error: staleUpdateError } = await ownerClient
    .from("flashcards")
    .update({ front: "Stale update must not land" })
    .eq("id", fixtures.target.id)
    .eq("updated_at", targetBefore.updated_at)
    .select("id");
  assert(!staleUpdateError && staleUpdated.length === 0, "stale owner update affects no rows");
  await assertOwnerSnapshotUnchanged(beforeDeniedWrite, "stale owner update leaves the complete owner state unchanged");

  beforeDeniedWrite = await ownerSnapshot();
  const { data: staleDeleted, error: staleDeleteError } = await ownerClient
    .from("flashcards")
    .delete()
    .eq("id", fixtures.target.id)
    .eq("updated_at", targetBefore.updated_at)
    .select("id");
  assert(!staleDeleteError && staleDeleted.length === 0, "stale owner delete affects no rows");
  await assertOwnerSnapshotUnchanged(beforeDeniedWrite, "stale owner delete leaves the complete owner state unchanged");

  beforeDeniedWrite = await ownerSnapshot();
  const { data: otherConditionallyUpdated, error: otherConditionalUpdateError } = await otherClient
    .from("flashcards")
    .update({ front: "Cross-account conditional update" })
    .eq("id", fixtures.target.id)
    .eq("updated_at", updatedCard.updated_at)
    .select("id");
  assert(
    !otherConditionalUpdateError && otherConditionallyUpdated.length === 0,
    "second user cannot conditionally update the owner's current version",
  );
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "cross-account conditional update leaves the complete owner state unchanged",
  );

  beforeDeniedWrite = await ownerSnapshot();
  const { data: otherConditionallyDeleted, error: otherConditionalDeleteError } = await otherClient
    .from("flashcards")
    .delete()
    .eq("id", fixtures.target.id)
    .eq("updated_at", updatedCard.updated_at)
    .select("id");
  assert(
    !otherConditionalDeleteError && otherConditionallyDeleted.length === 0,
    "second user cannot conditionally delete the owner's current version",
  );
  await assertOwnerSnapshotUnchanged(
    beforeDeniedWrite,
    "cross-account conditional delete leaves the complete owner state unchanged",
  );

  const { data: approvedRows, error: approvedInsertError } = await ownerClient
    .from("flashcards")
    .insert(fixtures.approved)
    .select("id, user_id, front, back")
    .order("id");
  assert(!approvedInsertError && approvedRows.length === fixtures.approved.length, "approved set inserts in one batch");

  const selectedIds = [...fixtures.approved.map(({ id }) => id), fixtures.sentinelId];
  const { data: durableApprovedRows, error: durableApprovedError } = await ownerClient
    .from("flashcards")
    .select("id, user_id, front, back")
    .in("id", selectedIds)
    .order("id");
  const expectedApprovedRows = fixtures.approved.map((card) => ({
    id: card.id,
    user_id: ownerId,
    front: card.front,
    back: card.back,
  }));
  assert(
    !durableApprovedError && JSON.stringify(durableApprovedRows) === JSON.stringify(expectedApprovedRows),
    "independent read contains exactly the submitted approved ID/content/owner set and excludes the sentinel",
  );

  const beforeAtomicConflict = await ownerSnapshot();
  const { error: atomicConflictError } = await ownerClient
    .from("flashcards")
    .insert([fixtures.atomicNovel, { ...fixtures.approved[0], front: "Conflicting overwrite must not land" }]);
  assert(Boolean(atomicConflictError), "mixed novel/conflicting insert reports a primary-key conflict");
  await assertOwnerSnapshotUnchanged(
    beforeAtomicConflict,
    "conflicting multi-row insert preserves the complete pre-existing owner snapshot byte-for-byte",
  );
  const { data: novelRows, error: novelReadError } = await ownerClient
    .from("flashcards")
    .select("id")
    .eq("id", fixtures.atomicNovel.id);
  assert(!novelReadError && novelRows.length === 0, "conflicting multi-row insert persists no novel partial row");

  const beforeOwnerDelete = await ownerSnapshot();
  const { data: deletedCard, error: ownerDeleteError } = await ownerClient
    .from("flashcards")
    .delete()
    .eq("id", fixtures.target.id)
    .eq("updated_at", updatedCard.updated_at)
    .select("id")
    .single();
  assert(!ownerDeleteError && deletedCard?.id === fixtures.target.id, "owner deletes the selected target card");
  const expectedAfterDelete = beforeOwnerDelete.filter((card) => card.id !== fixtures.target.id);
  const afterOwnerDelete = await ownerSnapshot();
  assertJsonEqual(afterOwnerDelete, expectedAfterDelete, "owner deletion removes exactly the selected target row");
  assertJsonEqual(
    afterOwnerDelete.find((card) => card.id === fixtures.decoy.id),
    decoyBefore,
    "owner deletion leaves the decoy row byte-for-byte unchanged",
  );

  console.log("Flashcard RLS verification passed. Cleanup: run `npm run db:reset` to remove transient users and rows.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Flashcard RLS verification failed.");
  process.exitCode = 1;
});
