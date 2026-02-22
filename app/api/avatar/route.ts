import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";

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

  const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
  const body = await object.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
