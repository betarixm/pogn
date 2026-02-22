import { eq, isNull, and, desc, count, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { PostId, UserId, LayerId, PostVisibility } from "@/database/types";
import * as schema from "@/database/schema";

export type FeedPostAuthor = {
  id: UserId;
  username: string;
};

export type FeedPostLayer = {
  id: LayerId;
  name: string;
};

export type FeedPost = {
  id: PostId;
  content: string;
  visibility: PostVisibility;
  author: FeedPostAuthor;
  layer: FeedPostLayer | null;
  heartCount: number;
  replyCount: number;
  createdAt: number;
};

export const getPosts = async (database: AppDatabase): Promise<FeedPost[]> => {
  const postRows = await database
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      visibility: schema.posts.visibility,
      createdAt: schema.posts.createdAt,
      authorId: schema.users.id,
      authorUsername: schema.users.username,
      layerId: schema.layers.id,
      layerName: schema.layers.name,
    })
    .from(schema.posts)
    .where(and(isNull(schema.posts.deletedAt), isNull(schema.posts.parentId)))
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .leftJoin(schema.layers, eq(schema.posts.layerId, schema.layers.id))
    .orderBy(desc(schema.posts.createdAt))
    .all();

  if (postRows.length === 0) {
    return [];
  }

  const postIds = postRows.map((r) => r.id);

  const heartCountRows = await database
    .select({ postId: schema.postHearts.postId, value: count() })
    .from(schema.postHearts)
    .where(inArray(schema.postHearts.postId, postIds))
    .groupBy(schema.postHearts.postId)
    .all();

  const heartCountMap = new Map<string, number>();
  for (const r of heartCountRows) {
    heartCountMap.set(r.postId, r.value);
  }

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

  const replyCountMap = new Map<string, number>();
  for (const r of replyCountRows) {
    if (r.parentId !== null) {
      replyCountMap.set(r.parentId, r.value);
    }
  }

  return postRows.map((row) => ({
    id: row.id,
    content: row.content,
    visibility: row.visibility,
    createdAt: row.createdAt,
    author: { id: row.authorId, username: row.authorUsername },
    layer:
      row.layerId !== null && row.layerName !== null
        ? { id: row.layerId, name: row.layerName }
        : null,
    heartCount: heartCountMap.get(row.id) ?? 0,
    replyCount: replyCountMap.get(row.id) ?? 0,
  }));
};
