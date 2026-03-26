import assert from "node:assert/strict";
import test from "node:test";
import { assignImageSequence } from "../../../src/lib/generate/assets";

const assets = [
  { id: "a", url: "https://cdn.example/a.png", filename: "a" },
  { id: "b", url: "https://cdn.example/b.png", filename: "b" },
  { id: "c", url: "https://cdn.example/c.png", filename: "c" },
];

test("assignImageSequence reuses the first image for single mode", () => {
  const assigned = assignImageSequence({
    assets,
    count: 4,
    selectionMode: "single",
  });

  assert.deepEqual(assigned.map((asset) => asset.id), ["a", "a", "a", "a"]);
});

test("assignImageSequence cycles through images for sequence mode", () => {
  const assigned = assignImageSequence({
    assets,
    count: 8,
    selectionMode: "sequence",
  });

  assert.deepEqual(assigned.map((asset) => asset.id), [
    "a",
    "b",
    "c",
    "a",
    "b",
    "c",
    "a",
    "b",
  ]);
});
