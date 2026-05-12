import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDrainBudget,
  pickQueueDrainCandidates,
  GROK_POOL_CAPACITY_DEFAULT,
  GROK_DRAIN_BUDGET_PER_TICK,
  GROK_PER_USER_FAIRNESS_CAP,
} from "../../../src/lib/video/providers/grok-pool";

test("drain pipeline: budget computation honours pool capacity and per-tick cap", () => {
  // Pool 320 used out of 350 → 30 capacity, but maxPerTick caps it at 5
  const budget = computeDrainBudget({
    poolUsed: 320,
    capacity: GROK_POOL_CAPACITY_DEFAULT,
    maxPerTick: GROK_DRAIN_BUDGET_PER_TICK,
  });
  assert.equal(budget, 5);
});

test("drain pipeline: fairness cap demotes overflow user when budget exceeds cap", () => {
  // u1 spammed 15 tasks; u2 and u3 each have 1.
  // With budget > fairnessCap, demotion should let u2/u3 jump in ahead of u1's overflow.
  const queue = [
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `u1-${i}`,
      userId: "u1",
      createdAt: new Date(1000 + i),
    })),
    { id: "u2-0", userId: "u2", createdAt: new Date(1005) },
    { id: "u3-0", userId: "u3", createdAt: new Date(1006) },
  ];

  const picked = pickQueueDrainCandidates(queue, {
    budget: 12,
    fairnessCap: GROK_PER_USER_FAIRNESS_CAP,
  });

  // budget=12: first 10 of u1 (tier 0, FIFO) + u2-0 + u3-0 (tier 0, FIFO by createdAt)
  assert.equal(picked.length, 12);
  // u2-0 and u3-0 should be in top 12 (tier 0) while u1-10..u1-14 are demoted to tier 1
  assert.ok(picked.includes("u2-0"), "u2-0 jumps in ahead of u1 overflow");
  assert.ok(picked.includes("u3-0"), "u3-0 jumps in ahead of u1 overflow");
  assert.ok(!picked.includes("u1-10"), "u1-10 demoted (position 11 > cap)");
  assert.ok(!picked.includes("u1-14"), "u1-14 demoted (position 15 > cap)");
  // u1 should get exactly 10 slots (positions 1..10 are tier 0)
  assert.equal(picked.filter((id) => id.startsWith("u1-")).length, 10);
});

test("drain pipeline: tight budget still respects FIFO inside tier 0", () => {
  // With budget=5 ≤ fairnessCap, no demotion kicks in; pure FIFO wins.
  // u1's oldest 5 sweep the budget.
  const queue = [
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `u1-${i}`,
      userId: "u1",
      createdAt: new Date(1000 + i),
    })),
    { id: "u2-0", userId: "u2", createdAt: new Date(1005) },
  ];
  const picked = pickQueueDrainCandidates(queue, {
    budget: 5,
    fairnessCap: GROK_PER_USER_FAIRNESS_CAP,
  });
  assert.equal(picked.length, 5);
  // All 5 are u1's earliest (u1-0..u1-4 at createdAt 1000..1004) — u2-0 is at 1005.
  assert.deepEqual(picked, ["u1-0", "u1-1", "u1-2", "u1-3", "u1-4"]);
});

test("drain pipeline: empty queue returns empty picks", () => {
  assert.deepEqual(
    pickQueueDrainCandidates([], { budget: 5, fairnessCap: 10 }),
    [],
  );
});
