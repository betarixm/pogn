import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { createDatabaseClient } from "@/database/client";
import {
  countNewTopLevelPostsSince,
  getFeedHead,
} from "@/database/queries/map";

const parseCreatedAt = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return parsed;
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const sinceCreatedAt = parseCreatedAt(
    request.nextUrl.searchParams.get("sinceCreatedAt"),
  );
  const sincePostId = request.nextUrl.searchParams.get("sincePostId");

  if (sinceCreatedAt === null) {
    return NextResponse.json(
      { error: "sinceCreatedAt query parameter is required." },
      { status: 400 },
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);

  const feedHead = await getFeedHead(database);
  if (feedHead === null) {
    return NextResponse.json({
      hasNewPosts: false,
      newPostCount: 0,
      latestCreatedAt: null,
      latestPostId: null,
    });
  }

  const hasSameTimestampButDifferentHead =
    feedHead.createdAt === sinceCreatedAt &&
    sincePostId !== null &&
    sincePostId !== feedHead.id;
  const hasNewerTimestamp = feedHead.createdAt > sinceCreatedAt;

  if (!hasSameTimestampButDifferentHead && !hasNewerTimestamp) {
    return NextResponse.json({
      hasNewPosts: false,
      newPostCount: 0,
      latestCreatedAt: feedHead.createdAt,
      latestPostId: feedHead.id,
    });
  }

  const counted = await countNewTopLevelPostsSince(database, sinceCreatedAt);
  const newPostCount =
    hasSameTimestampButDifferentHead && counted === 0
      ? 1
      : Math.max(counted, 1);

  return NextResponse.json({
    hasNewPosts: true,
    newPostCount,
    latestCreatedAt: feedHead.createdAt,
    latestPostId: feedHead.id,
  });
};
