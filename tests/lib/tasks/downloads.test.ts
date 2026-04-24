import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildZipArchive } from "../../../src/lib/tasks/downloads";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("buildZipArchive keeps grouped file paths in zip", async () => {
  globalThis.fetch = (async () =>
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "video/mp4" },
    })) as typeof fetch;

  const zip = await buildZipArchive({
    rootFolder: "批量任务",
    items: [
      { url: "https://cdn.example.com/a.mp4", fileStem: "商品01/视频1" },
      { url: "https://cdn.example.com/b.mp4", fileStem: "商品02/视频1" },
    ],
  });

  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(zip);

  assert.ok(archive.file("批量任务/商品01/视频1.mp4"));
  assert.ok(archive.file("批量任务/商品02/视频1.mp4"));
});
