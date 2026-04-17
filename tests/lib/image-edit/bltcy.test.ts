import test from "node:test";
import assert from "node:assert/strict";
import { extractResponseImageUrl } from "../../../src/lib/image-edit/bltcy";

test("extractResponseImageUrl strips markdown trailing punctuation", () => {
  const url = extractResponseImageUrl({
    choices: [
      {
        message: {
          content:
            "\n![image1](https://webstatic.aiproxy.vip/output/example.jpg) [下载1](https://webstatic.aiproxy.vip/output/example.jpg)\n",
        },
      },
    ],
  });

  assert.equal(url, "https://webstatic.aiproxy.vip/output/example.jpg");
});

test("extractResponseImageUrl prefers structured image_url parts", () => {
  const url = extractResponseImageUrl({
    choices: [
      {
        message: {
          content: [
            {
              type: "image_url",
              image_url: {
                url: "https://webstatic.aiproxy.vip/output/structured.jpg",
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(url, "https://webstatic.aiproxy.vip/output/structured.jpg");
});
