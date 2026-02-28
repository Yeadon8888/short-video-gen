/**
 * Cloudflare R2 upload via AWS Sig V4 (TypeScript port of r2.py)
 */

async function hmac(key: BufferSource, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}

async function sha256hex(data: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signingKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const k1 = await hmac(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
  const k2 = await hmac(k1, region);
  const k3 = await hmac(k2, service);
  return hmac(k3, "aws4_request");
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicDomain: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const accessKey = process.env.S3_ID ?? "";
  const secretKey = process.env.S3_token ?? "";
  const publicDomain = process.env.R2_PUBLIC_DOMAIN ?? "";
  if (!accountId || !bucket || !accessKey || !secretKey || !publicDomain) return null;
  return { accountId, bucket, accessKey, secretKey, publicDomain };
}

/**
 * Upload a file buffer to R2, returns public URL or null on failure.
 * key: path within bucket (e.g. "users/ABC123/img-uuid.jpg")
 */
export async function uploadToR2(
  config: R2Config,
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<string | null> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const uri = `/${config.bucket}/${key}`;
  const region = "auto";
  const service = "s3";

  const payloadHash = await sha256hex(data);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    uri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  const sk = await signingKey(config.secretKey, dateStamp, region, service);
  const sigBytes = await hmac(sk, stringToSign);
  const signature = toHex(sigBytes);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${uri}`, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        Host: host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
      body: data,
    });
    if (res.ok || res.status === 200 || res.status === 204) {
      return `https://${config.publicDomain}/${key}`;
    }
    console.error(`R2 upload failed: HTTP ${res.status}`);
    return null;
  } catch (e) {
    console.error("R2 upload error:", e);
    return null;
  }
}

/** List objects under a prefix (simplified, returns keys) */
export async function listR2Objects(
  config: R2Config,
  prefix: string
): Promise<string[]> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const uri = `/${config.bucket}`;
  const region = "auto";
  const service = "s3";
  const queryString = `list-type=2&prefix=${encodeURIComponent(prefix)}`;

  const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256 of empty

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "GET",
    uri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  const sk = await signingKey(config.secretKey, dateStamp, region, service);
  const sigBytes = await hmac(sk, stringToSign);
  const signature = toHex(sigBytes);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(
      `https://${host}${uri}?${queryString}`,
      {
        headers: {
          Host: host,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
          Authorization: authorization,
        },
      }
    );
    const text = await res.text();
    // Parse XML keys
    const keys: string[] = [];
    const keyMatches = Array.from(text.matchAll(/<Key>([^<]+)<\/Key>/g));
    for (const m of keyMatches) {
      keys.push(m[1]);
    }
    return keys;
  } catch (e) {
    console.error("R2 list error:", e);
    return [];
  }
}

/** Delete an object from R2 */
export async function deleteR2Object(config: R2Config, key: string): Promise<boolean> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const uri = `/${config.bucket}/${key}`;
  const region = "auto";
  const service = "s3";
  const payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["DELETE", uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  const sk = await signingKey(config.secretKey, dateStamp, region, service);
  const sigBytes = await hmac(sk, stringToSign);
  const signature = toHex(sigBytes);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${uri}`, {
      method: "DELETE",
      headers: {
        Host: host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
      },
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}
