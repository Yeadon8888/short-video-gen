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

test("buildScriptInstruction can use an admin reference constraint template", () => {
  const instruction = buildScriptInstruction({
    baseInstruction: "Base prompt",
    referenceImageCount: 2,
    referencePromptTemplate: "后台约束：{{IMAGE_SCOPE}}",
  });

  assert.match(instruction, /后台约束/);
  assert.match(instruction, /同一商品的不同角度或细节补充/);
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
  assert.match(prompt, /Preserve its identity, packaging, colors and key details/);
  assert.match(prompt, /do not replace the product/);
});

test("buildFinalVideoPrompt mentions multiple reference images when available", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Cinematic product ad",
    referenceImageCount: 3,
  });

  assert.match(prompt, /all uploaded reference images/);
  assert.match(prompt, /different angles or detail views/);
});

test("buildFinalVideoPrompt can use an admin final constraint template", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Cinematic product ad",
    referenceImageCount: 1,
    referencePromptTemplate: "Admin final: {{REFERENCE_SCOPE}}",
  });

  assert.match(prompt, /Admin final/);
  assert.match(prompt, /exact product that must appear/);
});

test("buildFinalVideoPrompt language block does not self-negate for English", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    outputLanguage: "en",
  });

  assert.doesNotMatch(prompt, /English, not English/);
  assert.match(prompt, /Language: all speech, VO and baked-in text must be English/);
});

test("buildFinalVideoPrompt language block keeps non-English contrast clause", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    outputLanguage: "ms",
  });

  assert.match(prompt, /Language: all speech, VO and baked-in text must be Malay \(Malaysia\), not English/);
});

test("buildFinalVideoPrompt omits text blocks when script has no requested subtitles", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    outputLanguage: "en-my",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [
        {
          id: 1,
          scene_zh: "",
          sora_prompt: "",
          duration_s: 3,
          camera: "wide",
          voiceover: "",
          on_screen_text: [],
        },
      ],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      on_screen_text: [],
    },
  });

  assert.doesNotMatch(prompt, /Text \(/);
  assert.doesNotMatch(prompt, /VO \(/);
});

test("buildFinalVideoPrompt surfaces explicitly requested on-screen text", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      on_screen_text: [
        { text: "PENING BAU NAJIS KUCING?!", shot_id: 1, position: "center-left", locale: "ms" },
        "BUY NOW",
      ],
    },
  });

  assert.match(prompt, /Text \(render exactly\)/);
  assert.match(prompt, /"PENING BAU NAJIS KUCING\?!"/);
  assert.match(prompt, /shot 1/);
  assert.match(prompt, /center-left/);
  assert.match(prompt, /"BUY NOW"/);
});

test("buildFinalVideoPrompt translates source subtitles when manual language is selected", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    outputLanguage: "en-my",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [
        {
          id: 1,
          scene_zh: "",
          sora_prompt: "",
          duration_s: 3,
          camera: "wide",
          voiceover: "Haiya... banyak kucing, tapi bau dia...",
        },
      ],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      on_screen_text: [
        { text: "PENING BAU NAJIS KUCING?!", shot_id: 1, locale: "ms" },
      ],
    },
  });

  assert.match(prompt, /manual language selection overrides source text/);
  assert.match(prompt, /Text \(Malaysian English, localize if needed\)/);
  assert.match(prompt, /VO \(Malaysian English, localize if needed\)/);
  assert.doesNotMatch(prompt, /verbatim/);
  assert.doesNotMatch(prompt, /do not translate/);
});

test("buildFinalVideoPrompt keeps source subtitles verbatim in auto language mode", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    outputLanguage: "auto",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      on_screen_text: ["PENING BAU NAJIS KUCING?!"],
    },
  });

  assert.match(prompt, /Text \(render exactly\)/);
  assert.doesNotMatch(prompt, /localize if needed/);
});

test("buildFinalVideoPrompt falls back to per-shot on_screen_text when top-level missing", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      shots: [
        {
          id: 2,
          scene_zh: "",
          sora_prompt: "",
          duration_s: 3,
          camera: "close-up",
          on_screen_text: ["LIMITED TIME"],
        },
      ],
    },
  });

  assert.match(prompt, /"LIMITED TIME"/);
  assert.match(prompt, /shot 2/);
});

test("buildFinalVideoPrompt renders pacing constraints with concrete tempo", () => {
  const fast = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      pacing: "fast",
    },
  });
  assert.match(fast, /Pacing: fast, punchy cuts/);

  const custom = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      shots: [],
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      pacing: "前三秒强钩子",
    },
  });
  assert.match(custom, /Pacing:/);
  assert.match(custom, /前三秒强钩子/);
});

test("buildFinalVideoPrompt renders voiceovers and negatives when present", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    script: {
      creative_points: [],
      hook: "",
      plot_summary: "",
      full_sora_prompt: "",
      copy: { title: "", caption: "", first_comment: "" },
      shots: [
        {
          id: 1,
          scene_zh: "",
          sora_prompt: "",
          duration_s: 3,
          camera: "wide",
          voiceover: "Haiya, banyak kucing",
        },
      ],
      negative: ["no other brands", "no English voiceover"],
    },
  });

  assert.match(prompt, /VO \(speak exactly\)/);
  assert.match(prompt, /"Haiya, banyak kucing"/);
  assert.match(prompt, /Avoid: no other brands; no English voiceover/);
});

test("buildFinalVideoPrompt without script behaves identically to legacy callers", () => {
  const prompt = buildFinalVideoPrompt({
    scriptPrompt: "Base",
    referenceImageCount: 1,
  });
  assert.doesNotMatch(prompt, /On-screen text/);
  assert.doesNotMatch(prompt, /Pacing constraint/);
  assert.doesNotMatch(prompt, /Negative constraints/);
  assert.match(prompt, /Reference image constraints/);
});
