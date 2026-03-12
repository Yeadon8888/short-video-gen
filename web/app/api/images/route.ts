import { NextRequest, NextResponse } from "next/server";
import {
  deleteAsset,
  isUploadGatewayEnabled,
  listAssets,
  uploadAsset,
} from "@/lib/storage/gateway";
import { getWorkspaceIdFromHeaders } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  if (!isUploadGatewayEnabled()) {
    return NextResponse.json({ urls: [], gateway_enabled: false });
  }

  try {
    const workspaceId = getWorkspaceIdFromHeaders(req.headers);
    const urls = await listAssets(workspaceId);
    return NextResponse.json({ urls, gateway_enabled: true });
  } catch (e) {
    return NextResponse.json(
      { urls: [], gateway_enabled: true, error: String(e) },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isUploadGatewayEnabled()) {
    return NextResponse.json({ error: "Upload gateway not configured" }, { status: 503 });
  }

  try {
    const workspaceId = getWorkspaceIdFromHeaders(req.headers);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const asset = await uploadAsset({
      workspaceId,
      filename: file.name,
      data: buffer,
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json(asset);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isUploadGatewayEnabled()) {
    return NextResponse.json({ error: "Upload gateway not configured" }, { status: 503 });
  }

  const workspaceId = getWorkspaceIdFromHeaders(req.headers);
  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "No key provided" }, { status: 400 });

  const ok = await deleteAsset(workspaceId, key);
  return NextResponse.json({ ok });
}
