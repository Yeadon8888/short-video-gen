import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NEW_USER_FREE_CREDITS,
  normalizeNewUserFreeCredits,
  resolveInitialCredits,
  shouldInsertNewUserCreditTxn,
} from "../../src/lib/onboarding";

test("new users receive 10 free credits by default", () => {
  assert.equal(DEFAULT_NEW_USER_FREE_CREDITS, 10);
  assert.equal(resolveInitialCredits({ isFirstUser: false, configuredCredits: undefined }), 10);
});

test("first admin keeps bootstrap credits", () => {
  assert.equal(resolveInitialCredits({ isFirstUser: true, configuredCredits: 10 }), 9999);
});

test("new user credit config is clamped to a safe integer range", () => {
  assert.equal(normalizeNewUserFreeCredits(undefined), 10);
  assert.equal(normalizeNewUserFreeCredits({ credits: 25 }), 25);
  assert.equal(normalizeNewUserFreeCredits({ credits: -1 }), 0);
  assert.equal(normalizeNewUserFreeCredits({ credits: 100_000 }), 10_000);
  assert.equal(normalizeNewUserFreeCredits({ credits: 1.5 }), 10);
});

test("credit transaction is only inserted when a non-admin gets credits", () => {
  assert.equal(shouldInsertNewUserCreditTxn({ isFirstUser: false, initialCredits: 10 }), true);
  assert.equal(shouldInsertNewUserCreditTxn({ isFirstUser: false, initialCredits: 0 }), false);
  assert.equal(shouldInsertNewUserCreditTxn({ isFirstUser: true, initialCredits: 9999 }), false);
});
