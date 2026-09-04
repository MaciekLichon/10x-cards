import assert from "node:assert/strict";
import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";

const SCHEDULER_VERSION = "5.4.2";
const CONFIG_VERSION = "fsrs-v6-defaults-v1";
const ACCEPTED_RATINGS = Object.freeze([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]);

const parameters = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36_500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});
const scheduler = fsrs(parameters);

function parseRating(value) {
  if (!Number.isInteger(value) || !ACCEPTED_RATINGS.includes(value)) {
    throw new TypeError("Rating must be an integer from 1 through 4.");
  }
  return value;
}

function toCanonicalIso(value) {
  const iso = value.toISOString();
  assert.equal(new Date(iso).toISOString(), iso);
  return iso;
}

assert.equal(CONFIG_VERSION, "fsrs-v6-defaults-v1");
assert.equal(SCHEDULER_VERSION, "5.4.2");
assert.equal(parameters.request_retention, 0.9);
assert.equal(parameters.maximum_interval, 36_500);
assert.equal(parameters.enable_fuzz, false);
assert.equal(parameters.enable_short_term, true);
assert.deepEqual(parameters.learning_steps, ["1m", "10m"]);
assert.deepEqual(parameters.relearning_steps, ["10m"]);
assert.equal(parameters.w.length, 21, "the pinned package supplies the FSRS v6 default weights");

const reviewedAt = new Date("2026-09-02T10:00:00.000Z");
for (const rating of ACCEPTED_RATINGS) {
  const result = scheduler.next(createEmptyCard(reviewedAt), reviewedAt, parseRating(rating));
  assert.equal(result.log.rating, rating);
  assert.equal(typeof toCanonicalIso(result.card.due), "string");
  assert.equal(typeof toCanonicalIso(result.log.review), "string");
  assert.equal(result.card.last_review && typeof toCanonicalIso(result.card.last_review), "string");
}

for (const invalidRating of [Rating.Manual, -1, 5, 1.5, "3", null]) {
  assert.throws(() => parseRating(invalidRating), TypeError);
}

console.log(`FSRS scheduler contract passed (${SCHEDULER_VERSION}, ${CONFIG_VERSION}).`);
