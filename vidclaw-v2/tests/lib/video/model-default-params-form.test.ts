import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultParamsPreview,
  defaultParamsToEditorState,
  editorStateToDefaultParams,
} from "../../../src/lib/video/model-default-params-form";

test("defaultParamsToEditorState splits common fields from extra provider params", () => {
  const state = defaultParamsToEditorState({
    orientation: "landscape",
    duration: 15,
    count: 2,
    allowedDurations: [10, 15],
    watermark: false,
    negative_prompt: "blurry",
  });

  assert.deepEqual(state, {
    orientation: "landscape",
    duration: "15",
    count: "2",
    allowedDurations: ["10", "15"],
    watermark: "false",
    extraParamsText: '{\n  "negative_prompt": "blurry"\n}',
  });
});

test("editorStateToDefaultParams merges common fields with extra params", () => {
  const result = editorStateToDefaultParams({
    orientation: "portrait",
    duration: "10",
    count: "3",
    allowedDurations: ["10", "15"],
    watermark: "false",
    extraParamsText: '{\n  "negative_prompt": "blurry"\n}',
  });

  assert.deepEqual(result, {
    ok: true,
    payload: {
      orientation: "portrait",
      duration: 10,
      count: 3,
      allowedDurations: [10, 15],
      watermark: false,
      negative_prompt: "blurry",
    },
  });
});

test("editorStateToDefaultParams rejects duplicate common keys in extra params", () => {
  const result = editorStateToDefaultParams({
    orientation: "portrait",
    duration: "10",
    count: "",
    allowedDurations: ["10"],
    watermark: "inherit",
    extraParamsText: '{\n  "duration": 15\n}',
  });

  assert.deepEqual(result, {
    ok: false,
    error: "高级参数 JSON 请不要重复填写这些字段：duration",
  });
});

test("editorStateToDefaultParams rejects a default duration outside allowedDurations", () => {
  const result = editorStateToDefaultParams({
    orientation: "",
    duration: "8",
    count: "",
    allowedDurations: ["10", "15"],
    watermark: "inherit",
    extraParamsText: "{}",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "默认时长必须包含在允许时长中",
  });
});

test("buildDefaultParamsPreview renders merged params as formatted JSON", () => {
  const preview = buildDefaultParamsPreview({
    orientation: "portrait",
    duration: "10",
    count: "",
    allowedDurations: ["10", "15"],
    watermark: "false",
    extraParamsText: '{\n  "negative_prompt": "blurry"\n}',
  });

  assert.equal(
    preview,
    '{\n  "negative_prompt": "blurry",\n  "orientation": "portrait",\n  "duration": 10,\n  "allowedDurations": [\n    10,\n    15\n  ],\n  "watermark": false\n}',
  );
});
