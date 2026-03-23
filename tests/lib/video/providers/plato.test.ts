import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlatoBaseUrl } from "../../../../src/lib/video/providers/plato";

test("normalizePlatoBaseUrl keeps host-only values unchanged", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai"),
    "https://api.bltcy.ai",
  );
});

test("normalizePlatoBaseUrl strips a pasted generations endpoint", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai/v2/videos/generations"),
    "https://api.bltcy.ai",
  );
});

test("normalizePlatoBaseUrl strips a pasted generations status url", () => {
  assert.equal(
    normalizePlatoBaseUrl("https://api.bltcy.ai/v2/videos/generations/task_123"),
    "https://api.bltcy.ai",
  );
});
