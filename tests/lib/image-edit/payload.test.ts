import test from "node:test";
import assert from "node:assert/strict";
import { buildImageDataUrl, canUseRemoteImageUrl } from "../../../src/lib/image-edit/payload";

test("canUseRemoteImageUrl accepts absolute http urls", () => {
  assert.equal(
    canUseRemoteImageUrl("https://vc-upload.yeadon.top/files/example.jpg"),
    true,
  );
});

test("canUseRemoteImageUrl rejects data urls", () => {
  assert.equal(
    canUseRemoteImageUrl("data:image/png;base64,abc"),
    false,
  );
});

test("buildImageDataUrl encodes binary buffers as data urls", () => {
  const dataUrl = buildImageDataUrl({
    mimeType: "image/png",
    buffer: new Uint8Array([1, 2, 3]).buffer,
  });

  assert.equal(dataUrl, "data:image/png;base64,AQID");
});
