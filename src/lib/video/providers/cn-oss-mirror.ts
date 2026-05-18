import crypto from "node:crypto";

/**
 * 国内出口镜像 —— 把参考图镜像到大陆 OSS,给国内侧上游(newtoken→Seedance,
 * 服务器在境内)一个它能快速拉取的 https 地址。我们(海外)→ Cloudflare 拉图
 * 是快的;Seedance(境内)→ Cloudflare 不稳。镜像只对需要它的模型开启。
 *
 * 配置缺失或任一步失败时,原样返回入参 URL —— 退化成镜像前的行为,不抛错、
 * 不引入回归。对象生命周期(1 天自动删)由 OSS 桶规则托管,这里只上传。
 */

interface CnOssConfig {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint: string;
}

function readConfig(): CnOssConfig | null {
  const accessKeyId = process.env.CN_OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.CN_OSS_ACCESS_KEY_SECRET?.trim();
  const bucket = process.env.CN_OSS_BUCKET?.trim();
  const endpoint = process.env.CN_OSS_ENDPOINT?.trim();
  if (!accessKeyId || !accessKeySecret || !bucket || !endpoint) return null;
  return { accessKeyId, accessKeySecret, bucket, endpoint };
}

const PREFIX = "cn-mirror/"; // RAM 策略只授权这个前缀

function extFromContentType(ct: string): string {
  if (ct.includes("webp")) return "webp";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return "bin";
}

function sign(
  cfg: CnOssConfig,
  verb: string,
  contentType: string,
  date: string,
  resource: string,
): string {
  const stringToSign = `${verb}\n\n${contentType}\n${date}\n${resource}`;
  const sig = crypto
    .createHmac("sha1", cfg.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  return `OSS ${cfg.accessKeyId}:${sig}`;
}

async function mirrorOne(cfg: CnOssConfig, sourceUrl: string): Promise<string> {
  const src = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  if (!src.ok) throw new Error(`fetch source ${src.status}`);
  const contentType = src.headers.get("content-type") || "image/webp";
  const body = Buffer.from(await src.arrayBuffer());

  const key = `${PREFIX}${crypto.randomUUID()}.${extFromContentType(contentType)}`;
  const host = `${cfg.bucket}.${cfg.endpoint}`;
  const publicUrl = `https://${host}/${key}`;
  const date = new Date().toUTCString();

  const res = await fetch(publicUrl, {
    method: "PUT",
    headers: {
      Host: host,
      Date: date,
      "Content-Type": contentType,
      Authorization: sign(cfg, "PUT", contentType, date, `/${cfg.bucket}/${key}`),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`OSS PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return publicUrl;
}

/**
 * 逐张镜像到国内 OSS,返回与入参等长的 URL 数组。任一张失败 → 该张回退原 URL。
 */
export async function mirrorReferenceImagesToCnOss(
  imageUrls: string[],
): Promise<string[]> {
  if (imageUrls.length === 0) return imageUrls;
  const cfg = readConfig();
  if (!cfg) {
    console.warn(
      "[cn-oss-mirror] CN_OSS_* env not set — skip mirror, use original URLs",
    );
    return imageUrls;
  }

  return Promise.all(
    imageUrls.map(async (url) => {
      try {
        return await mirrorOne(cfg, url);
      } catch (err) {
        console.warn(
          `[cn-oss-mirror] mirror failed, fallback to original: ${
            err instanceof Error ? err.message : err
          }`,
        );
        return url;
      }
    }),
  );
}
