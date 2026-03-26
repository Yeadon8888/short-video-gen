import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinalVideoPrompt,
  buildScriptInstruction,
} from "../../../src/lib/video/prompt";

test("buildScriptInstruction leaves prompts unchanged when there are no reference images", () => {
  const instruction = buildScriptInstruction({
    baseInstruction: "Base prompt",
    referenceImageCount: 0,
  });

  assert.equal(instruction, "Base prompt");
});

test("buildScriptInstruction appends mandatory product constraints for reference images", () => {
  const instruction = buildScriptInstruction({
    baseInstruction: "Base prompt",
    referenceImageCount: 2,
  });

  assert.match(instruction, /参考图强约束/);
  assert.match(instruction, /同一商品的不同角度或细节补充/);
  assert.match(instruction, /full_sora_prompt/);
});

test("buildScriptInstruction keeps user creative brief in the final Gemini instruction", () => {
  const instruction = buildScriptInstruction({
    baseInstruction: "Base prompt",
    creativeBrief: "前三秒强钩子，强调质感",
  });

  assert.match(instruction, /用户补充要求/);
  assert.match(instruction, /前三秒强钩子/);
});

test("buildFinalVideoPrompt appends reference-product constraints to the final provider prompt", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Cinematic product ad",
    referenceImageCount: 1,
  });

  assert.match(prompt, /^Cinematic product ad/);
  assert.match(prompt, /Reference image constraints/);
  assert.match(prompt, /must stay clearly visible and prominent/);
  assert.match(prompt, /Do not replace the product/);
});

test("buildFinalVideoPrompt mentions multiple reference images when available", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Cinematic product ad",
    referenceImageCount: 3,
  });

  assert.match(prompt, /all uploaded reference images/);
  assert.match(prompt, /different angles or detail views/);
});
