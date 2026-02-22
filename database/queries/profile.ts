import { eq, isNull, isNotNull, and, desc, count, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { PostId, UserId, LayerId, PostVisibility } from "@/database/types";
import * as schema from "@/database/schema";

export type ProfileUser = {
  id: UserId;
  username: string;
  avatarObjectKey: string | null;
  createdAt: number;
};

export type ProfilePost = {
  id: PostId;
  content: string;
  visibility: PostVisibility;
  layer: { id: LayerId; name: string } | null;
  heartCount: number;
  replyCount: number;
  createdAt: number;
};

export type ProfileReply = {
  id: PostId;
  content: string;
  visibility: PostVisibility;
  parentId: PostId;
  heartCount: number;
  createdAt: number;
};

export type UserProfileData = {
  user: ProfileUser;
  posts: ProfilePost[];
  replies: ProfileReply[];
};

export const getUserProfileData = async (
  database: AppDatabase,
  userId: UserId,
  isAuthenticated: boolean,
): Promise<UserProfileData | null> => {
  const userRow = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      avatarObjectKey: schema.users.avatarObjectKey,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (userRow === undefined) {
    return null;
  }

  const postFilter = and(
    eq(schema.posts.authorId, userId),
    isNull(schema.posts.deletedAt),
    isNull(schema.posts.parentId),
  );

  const replyFilter = and(
    eq(schema.posts.authorId, userId),
    isNull(schema.posts.deletedAt),
    isNotNull(schema.posts.parentId),
  );

  const postRows = await database
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      visibility: schema.posts.visibility,
      createdAt: schema.posts.createdAt,
      layerId: schema.layers.id,
      layerName: schema.layers.name,
    })
    .from(schema.posts)
    .where(postFilter)
    .leftJoin(schema.layers, eq(schema.posts.layerId, schema.layers.id))
    .orderBy(desc(schema.posts.createdAt))
    .all();

  const replyRows = await database
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      visibility: schema.posts.visibility,
      parentId: schema.posts.parentId,
      createdAt: schema.posts.createdAt,
    })
    .from(schema.posts)
    .where(replyFilter)
    .orderBy(desc(schema.posts.createdAt))
    .all();

  const postIds = postRows.map((r) => r.id);
  const replyIds = replyRows.map((r) => r.id);
  const allIds = [...postIds, ...replyIds];

  const heartCountMap = new Map<string, number>();
  if (allIds.length > 0) {
    const heartRows = await database
      .select({ postId: schema.postHearts.postId, value: count() })
      .from(schema.postHearts)
      .where(inArray(schema.postHearts.postId, allIds))
      .groupBy(schema.postHearts.postId)
      .all();
    for (const r of heartRows) {
      heartCountMap.set(r.postId, r.value);
    }
  }

  const replyCountMap = new Map<string, number>();
  if (postIds.length > 0) {
    const replyCountRows = await database
      .select({ parentId: schema.posts.parentId, value: count() })
      .from(schema.posts)
      .where(
        and(
          inArray(schema.posts.parentId, postIds),
          isNull(schema.posts.deletedAt),
        ),
      )
      .groupBy(schema.posts.parentId)
      .all();
    for (const r of replyCountRows) {
      if (r.parentId !== null) {
        replyCountMap.set(r.parentId, r.value);
      }
    }
  }

  return {
    user: {
      id: userRow.id,
      username: userRow.username,
      avatarObjectKey: userRow.avatarObjectKey,
      createdAt: userRow.createdAt,
    },
    posts: postRows.map((row) => ({
      id: row.id,
      content:
        !isAuthenticated && row.visibility === "members" ? "" : row.content,
      visibility: row.visibility,
      createdAt: row.createdAt,
      layer:
        row.layerId !== null && row.layerName !== null
          ? { id: row.layerId, name: row.layerName }
          : null,
      heartCount: heartCountMap.get(row.id) ?? 0,
      replyCount: replyCountMap.get(row.id) ?? 0,
    })),
    replies: replyRows
      .filter((row) => row.parentId !== null)
      .map((row) => ({
        id: row.id,
        content:
          !isAuthenticated && row.visibility === "members" ? "" : row.content,
        visibility: row.visibility,
        parentId: row.parentId as PostId,
        heartCount: heartCountMap.get(row.id) ?? 0,
        createdAt: row.createdAt,
      })),
  };
};
