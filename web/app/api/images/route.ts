import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getR2Config, uploadToR2, listR2Objects, deleteR2Object } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r2Config = getR2Config();
  if (!r2Config) {
    return NextResponse.json({ urls: [], r2_enabled: false });
  }

  const prefix = `users/${session.code}/`;
  const keys = await listR2Objects(r2Config, prefix);
  const urls = keys.map((k) => ({
    key: k,
    url: `https://${r2Config.publicDomain}/${k}`,
  }));

  return NextResponse.json({ urls, r2_enabled: true });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r2Config = getR2Config();
  if (!r2Config) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `users/${session.code}/img-${uuidv4()}.${ext}`;
  const contentType = getContentType(file.name);

  const buffer = await file.arrayBuffer();
  const url = await uploadToR2(r2Config, key, buffer, contentType);

  if (!url) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ url, key });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r2Config = getR2Config();
  if (!r2Config) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

  // Security: ensure key belongs to this user
  if (!key.startsWith(`users/${session.code}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await deleteR2Object(r2Config, key);
  return NextResponse.json({ ok });
}
