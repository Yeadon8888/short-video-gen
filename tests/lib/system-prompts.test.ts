import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SYSTEM_PROMPTS,
  applyReferencePromptPlaceholders,
  applyScriptPromptPlaceholders,
  cleanSystemPrompts,
  mergeSystemPrompts,
} from "../../src/lib/system-prompts";

test("mergeSystemPrompts fills missing values from code defaults", () => {
  const merged = mergeSystemPrompts({
    theme_to_video: "Custom {{THEME}}",
  });

  assert.equal(merged.theme_to_video, "Custom {{THEME}}");
  assert.equal(
    merged.product_white_bg,
    DEFAULT_SYSTEM_PROMPTS.product_white_bg,
  );
});

test("cleanSystemPrompts drops unknown keys and blank non-copy prompts", () => {
  const cleaned = cleanSystemPrompts({
    theme_to_video: "  ",
    copy_generation: "  ",
    product_white_bg: "  white bg prompt  ",
    unknown: "nope",
  });

  assert.deepEqual(cleaned, {
    copy_generation: "",
    product_white_bg: "white bg prompt",
  });
});

test("applyScriptPromptPlaceholders replaces runtime values", () => {
  const prompt = applyScriptPromptPlaceholders({
    template: "主题={{THEME}}\n修改={{MODIFICATION_PROMPT}}{{CREATIVE_BRIEF_SECTION}}",
    theme: "护肤新品",
    modification: "前三秒强钩子",
    creativeBrief: "突出质感",
  });

  assert.match(prompt, /主题=护肤新品/);
  assert.match(prompt, /修改=前三秒强钩子/);
  assert.match(prompt, /补充要求：突出质感/);
});

test("applyReferencePromptPlaceholders replaces image and final scopes", () => {
  const prompt = applyReferencePromptPlaceholders({
    template: "{{IMAGE_SCOPE}}\n{{REFERENCE_SCOPE}}",
    imageScope: "中文参考图约束",
    referenceScope: "English final constraint",
  });

  assert.equal(prompt, "中文参考图约束\nEnglish final constraint");
});
