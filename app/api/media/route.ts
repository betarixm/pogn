import { type NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { uuidv7 } from "uuidv7";
import { getServerSession } from "@/lib/auth";
import { createUserId } from "@/database/types";
import type { AttachmentRecord } from "@/app/posts/types";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const GET = async (request: NextRequest): Promise<Response> => {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return new NextResponse(null, { status: 400 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.AVATARS.get(key);
  if (!object) {
    return new NextResponse(null, { status: 404 });
  }
  const contentType =
    object.httpMetadata?.contentType ?? "application/octet-stream";
  const body = await object.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const session = await getServerSession();
  if (session === null) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const rawFiles = formData.getAll("files");
  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `최대 ${MAX_FILES}장까지 업로드 가능합니다.` },
      { status: 400 },
    );
  }

  const userId = createUserId(session.user.id);
  const { env } = await getCloudflareContext({ async: true });

  const attachments: AttachmentRecord[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드 가능합니다 (JPEG, PNG, WebP, GIF)." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "이미지 파일 크기는 10MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ext = MIME_TO_EXT[file.type] ?? "bin";
    const objectKey = `posts/${userId}/${uuidv7()}.${ext}`;

    await env.AVATARS.put(objectKey, buffer, {
      httpMetadata: { contentType: file.type },
    });

    attachments.push({
      objectKey,
      contentType: file.type,
      byteSize: file.size,
      sha256,
      displayOrder: i,
    });
  }

  return NextResponse.json({ attachments });
};
