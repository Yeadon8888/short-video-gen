import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLanguageSpec,
  resolveScriptGenerationConfigFromModel,
} from "../../src/lib/gemini";

test("resolveScriptGenerationConfigFromModel prefers admin model config", () => {
  const config = resolveScriptGenerationConfigFromModel(
    {
      id: "model_1",
      slug: "gemini-3.1-pro-preview",
      apiKey: "admin-key",
      baseUrl: "https://proxy.example.com",
    },
    {
      GEMINI_MODEL: "env-model",
      GEMINI_API_KEY: "env-key",
      GEMINI_BASE_URL: "https://env.example.com",
    } as unknown as NodeJS.ProcessEnv,
  );

  assert.deepEqual(config, {
    model: "gemini-3.1-pro-preview",
    apiKey: "admin-key",
    baseUrl: "https://proxy.example.com",
    source: "admin_model",
  });
});

test("resolveScriptGenerationConfigFromModel falls back to env when no admin model is configured", () => {
  const config = resolveScriptGenerationConfigFromModel(
    null,
    {
      GEMINI_MODEL: "env-model",
      GEMINI_API_KEY: "env-key",
      GEMINI_BASE_URL: "https://env.example.com",
    } as unknown as NodeJS.ProcessEnv,
  );

  assert.deepEqual(config, {
    model: "env-model",
    apiKey: "env-key",
    baseUrl: "https://env.example.com",
    source: "env",
  });
});

test("resolveLanguageSpec maps Mexican Spanish to spoken and content constraints", () => {
  const spec = resolveLanguageSpec("es-mx");

  assert.equal(spec.spoken, "Mexican Spanish");
  assert.equal(spec.content, "Mexican Spanish");
  assert.match(spec.instruction, /Mexican Spanish/i);
  assert.match(spec.instruction, /Do not output English copy/i);
});

test("resolveLanguageSpec keeps auto mode as user-driven market language", () => {
  const spec = resolveLanguageSpec("auto");

  assert.match(spec.instruction, /If the user explicitly specifies a language/i);
  assert.match(spec.instruction, /Do not silently switch to English/i);
});

test("resolveLanguageSpec supports Malay and Malaysian English", () => {
  const malay = resolveLanguageSpec("ms");
  const malaysianEnglish = resolveLanguageSpec("en-my");

  assert.equal(malay.spoken, "Malay (Malaysia)");
  assert.equal(malay.content, "Malay (Malaysia)");
  assert.match(malay.instruction, /Malay as used in Malaysia/i);

  assert.equal(malaysianEnglish.spoken, "Malaysian English");
  assert.equal(malaysianEnglish.content, "Malaysian English");
  assert.match(malaysianEnglish.instruction, /Malaysian English/i);
});
