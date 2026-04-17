import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGenerateReplayHref,
  parseGenerateReplayPreset,
} from "../../../src/lib/generate/preset";

test("buildGenerateReplayHref persists output language and tiktok platform", () => {
  const href = buildGenerateReplayHref({
    tab: "batch",
    batchTheme: "Sell this product",
    params: {
      platform: "tiktok",
      outputLanguage: "es-mx",
      duration: 6,
      orientation: "portrait",
    },
  });

  assert.match(href, /platform=tiktok/);
  assert.match(href, /outputLanguage=es-mx/);
  assert.match(href, /duration=6/);
});

test("parseGenerateReplayPreset restores output language and 6-second duration", () => {
  const params = new URLSearchParams(
    "tab=theme&platform=tiktok&outputLanguage=es-mx&duration=6&orientation=portrait",
  );

  const preset = parseGenerateReplayPreset({
    get(name: string) {
      return params.get(name);
    },
  });

  assert.equal(preset.tab, "theme");
  assert.equal(preset.params?.platform, "tiktok");
  assert.equal(preset.params?.outputLanguage, "es-mx");
  assert.equal(preset.params?.duration, 6);
});

test("parseGenerateReplayPreset restores Malay language options", () => {
  const params = new URLSearchParams(
    "tab=theme&platform=tiktok&outputLanguage=en-my&duration=10&orientation=portrait",
  );

  const preset = parseGenerateReplayPreset({
    get(name: string) {
      return params.get(name);
    },
  });

  assert.equal(preset.params?.outputLanguage, "en-my");
});
