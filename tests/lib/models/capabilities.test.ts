import test from "node:test";
import assert from "node:assert/strict";
import {
  getModelCapabilityLabel,
  isModelCapability,
  MODEL_CAPABILITIES,
} from "../../../src/lib/models/capabilities";

test("script_generation is treated as a valid model capability", () => {
  assert.equal(isModelCapability("script_generation"), true);
});

test("getModelCapabilityLabel returns the script generation label", () => {
  assert.equal(
    getModelCapabilityLabel(MODEL_CAPABILITIES.scriptGeneration),
    "脚本分析",
  );
});
