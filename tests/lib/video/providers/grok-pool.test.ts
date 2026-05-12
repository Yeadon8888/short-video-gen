import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDrainBudget,
  pickQueueDrainCandidates,
  estimateQueueWaitMinutes,
  GROK_POOL_CAPACITY_DEFAULT,
  GROK_DRAIN_BUDGET_PER_TICK,
  GROK_PER_USER_FAIRNESS_CAP,
} from "../../../../src/lib/video/providers/grok-pool";

test("computeDrainBudget returns 0 when pool fully used", () => {
  assert.equal(computeDrainBudget({ poolUsed: 350, capacity: 350, maxPerTick: 5 }), 0);
});

test("computeDrainBudget caps at maxPerTick when capacity is large", () => {
  assert.equal(computeDrainBudget({ poolUsed: 0, capacity: 350, maxPerTick: 5 }), 5);
});

test("computeDrainBudget never returns negative", () => {
  assert.equal(computeDrainBudget({ poolUsed: 400, capacity: 350, maxPerTick: 5 }), 0);
});

test("computeDrainBudget returns remaining when capacity tighter than maxPerTick", () => {
  assert.equal(computeDrainBudget({ poolUsed: 348, capacity: 350, maxPerTick: 5 }), 2);
});

test("pickQueueDrainCandidates returns tasks in FIFO order under fairness cap", () => {
  const tasks = [
    { id: "t1", userId: "u1", createdAt: new Date(1000) },
    { id: "t2", userId: "u2", createdAt: new Date(2000) },
    { id: "t3", userId: "u1", createdAt: new Date(3000) },
  ];
  const picked = pickQueueDrainCandidates(tasks, { budget: 10, fairnessCap: 10 });
  assert.deepEqual(picked, ["t1", "t2", "t3"]);
});

test("pickQueueDrainCandidates demotes tasks beyond per-user cap", () => {
  // u1 has 12 tasks, u2 has 1 task. cap=10 means u1's 11th and 12th are demoted.
  const tasks = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `u1-t${i + 1}`,
      userId: "u1",
      createdAt: new Date(1000 + i),
    })),
    { id: "u2-t1", userId: "u2", createdAt: new Date(2000) },
  ];
  const picked = pickQueueDrainCandidates(tasks, { budget: 13, fairnessCap: 10 });
  // First 10 of u1 + u2's 1 task should come before u1's overflow
  assert.equal(picked[10], "u2-t1", "u2 should jump in before u1 overflow");
  assert.deepEqual(picked.slice(11), ["u1-t11", "u1-t12"]);
});

test("pickQueueDrainCandidates respects budget", () => {
  const tasks = [
    { id: "t1", userId: "u1", createdAt: new Date(1000) },
    { id: "t2", userId: "u2", createdAt: new Date(2000) },
  ];
  assert.deepEqual(pickQueueDrainCandidates(tasks, { budget: 1, fairnessCap: 10 }), ["t1"]);
});

test("estimateQueueWaitMinutes rounds up using drain rate", () => {
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 0, drainRatePerMin: 4 }), 0);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 1, drainRatePerMin: 4 }), 1);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 4, drainRatePerMin: 4 }), 1);
  assert.equal(estimateQueueWaitMinutes({ queueAhead: 5, drainRatePerMin: 4 }), 2);
});

test("constants have expected defaults", () => {
  assert.equal(GROK_POOL_CAPACITY_DEFAULT, 350);
  assert.equal(GROK_DRAIN_BUDGET_PER_TICK, 5);
  assert.equal(GROK_PER_USER_FAIRNESS_CAP, 10);
});
