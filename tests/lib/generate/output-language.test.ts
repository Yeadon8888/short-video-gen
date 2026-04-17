import test from "node:test";
import assert from "node:assert/strict";
import { resolveOutputLanguage as resolveGenerateOutputLanguage } from "../../../src/app/api/generate/route";
import { resolveOutputLanguage as resolveBatchOutputLanguage } from "../../../src/app/api/generate/batch/route";

test("generate route defaults TikTok auto language to English", () => {
  assert.equal(resolveGenerateOutputLanguage("auto", "tiktok"), "en");
  assert.equal(resolveGenerateOutputLanguage(undefined, "tiktok"), "en");
});

test("generate route keeps douyin auto language unresolved", () => {
  assert.equal(resolveGenerateOutputLanguage("auto", "douyin"), "auto");
});

test("batch route preserves explicit Mexican Spanish selection", () => {
  assert.equal(resolveBatchOutputLanguage("es-mx", "tiktok"), "es-mx");
});
