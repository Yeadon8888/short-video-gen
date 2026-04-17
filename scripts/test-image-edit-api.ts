import fs from "node:fs";

function parseEnv(file: string) {
  return Object.fromEntries(
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        let value = line.slice(index + 1).trim();
        value = value.replace(/^['"]|['"]$/g, "");
        return [line.slice(0, index).trim(), value];
      }),
  );
}

async function main() {
  const env = parseEnv(".env.vercel.production");
  const apiKey = process.env.TEST_IMAGE_API_KEY?.trim();
  const assetUrl =
    process.env.TEST_IMAGE_ASSET_URL?.trim() ||
    "https://vc-upload.yeadon.top/files/vidclaw-assets/d52a3554-7a13-4f18-9f08-d8025181d7c1/img-5b1a8edd-c8a7-425d-954e-3dbb02edb5ad.jpg";

  if (!apiKey) {
    throw new Error("TEST_IMAGE_API_KEY is required");
  }

  const assetResponse = await fetch(assetUrl, {
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  if (!assetResponse.ok) {
    throw new Error(`source asset fetch failed: HTTP ${assetResponse.status}`);
  }

  const assetBuffer = await assetResponse.arrayBuffer();
  const assetMimeType =
    assetResponse.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
  const assetDataUrl = `data:${assetMimeType};base64,${Buffer.from(assetBuffer).toString("base64")}`;

  const startedAt = Date.now();
  const response = await fetch("https://api.bltcy.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "gemini-3.1-flash-image-preview-4k",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "请基于这张商品图做图片编辑，不改变商品本身的材质、颜色、结构与品牌信息。要求：1. 智能抠出主体商品；2. 生成 9:16 竖版构图；3. 纯白背景；4. 商品完整居中展示；5. 保留真实商品边缘与细节；6. 输出适合电商展示的干净白底图。",
            },
            {
              type: "image_url",
              image_url: {
                url: assetDataUrl,
              },
            },
          ],
        },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  const text = await response.text();
  console.log(
    JSON.stringify(
      {
        status: response.status,
        elapsedMs: Date.now() - startedAt,
        bodyPreview: text.slice(0, 4000),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
