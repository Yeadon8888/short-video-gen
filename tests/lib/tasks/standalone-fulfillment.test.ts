import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveStandaloneSubmissionPlan,
} from "../../../src/lib/tasks/standalone-fulfillment";

test("grok standalone multi-count generation is queued through fulfillment", () => {
  assert.deepEqual(
    resolveStandaloneSubmissionPlan({
      requestedFulfillmentMode: "standard",
      provider: "grok2api",
      count: 5,
      scheduled: false,
    }),
    {
      fulfillmentMode: "backfill_until_target",
      submitInline: false,
    },
  );
});

test("grok standalone single-count generation can still submit inline", () => {
  assert.deepEqual(
    resolveStandaloneSubmissionPlan({
      requestedFulfillmentMode: "standard",
      provider: "grok2api",
      count: 1,
      scheduled: false,
    }),
    {
      fulfillmentMode: "standard",
      submitInline: true,
    },
  );
});

test("non-grok standalone generation keeps requested fulfillment behavior", () => {
  assert.deepEqual(
    resolveStandaloneSubmissionPlan({
      requestedFulfillmentMode: "backfill_until_target",
      provider: "plato",
      count: 3,
      scheduled: false,
    }),
    {
      fulfillmentMode: "backfill_until_target",
      submitInline: true,
    },
  );
});
