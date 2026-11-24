import path from "path";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { uploadExtension } from "@/lib/upload-content-types";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const ext = uploadExtension(file.type);
  if (!ext) return NextResponse.json({ error: "Content type not allowed" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is empty or too large" }, { status: 400 });
  }

  const key = `documents/${randomUUID()}.${ext}`;
  try {
    await minioClient.send(
      new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: new Uint8Array(await file.arrayBuffer()),
        ContentType: file.type,
      }),
    );
  } catch (error) {
    console.error("Failed to store upload:", error);
    return NextResponse.json({ error: "Failed to store upload" }, { status: 500 });
  }

  return NextResponse.json({
    key,
    size: file.size,
    mimeType: file.type,
    fileName: path.basename(file.name || "document"),
  });
}
