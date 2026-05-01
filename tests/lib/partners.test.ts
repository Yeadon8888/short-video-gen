import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPartnerLink,
  calculateCommissionFen,
  isValidPartnerCode,
  normalizePartnerCode,
} from "../../src/lib/partners";

test("partner code normalization keeps url-safe codes only", () => {
  assert.equal(normalizePartnerCode(" Alice-01_ "), "alice-01_");
  assert.equal(normalizePartnerCode("A!B@C#中文"), "abc");
});

test("partner code validation requires normalized code with minimum length", () => {
  assert.equal(isValidPartnerCode("abc"), true);
  assert.equal(isValidPartnerCode("alice-01"), true);
  assert.equal(isValidPartnerCode("Alice"), true);
  assert.equal(isValidPartnerCode("ab"), false);
  assert.equal(isValidPartnerCode("a b c"), false);
});

test("partner link uses /r/code route", () => {
  assert.equal(buildPartnerLink("https://video.yeadon.top/", "alice"), "https://video.yeadon.top/r/alice");
});

test("commission uses basis points and floors to whole fen", () => {
  assert.equal(calculateCommissionFen(10_000, 2_000), 2_000);
  assert.equal(calculateCommissionFen(9_999, 1_250), 1_249);
  assert.equal(calculateCommissionFen(10_000, 0), 0);
  assert.equal(calculateCommissionFen(-100, 2_000), 0);
});
