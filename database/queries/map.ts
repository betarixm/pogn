import { eq, gt, isNull, and, asc, desc, count, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { PostId, LayerId, UserId, AttachmentId, PostVisibility } from "@/database/types";
import { generateLayerId } from "@/database/types";
import * as schema from "@/database/schema";

export type MapPostAttachment = {
  id: AttachmentId;
  objectKey: string;
  contentType: string;
};

export type MapPost = {
  id: PostId;
  content: string;
  visibility: PostVisibility;
  latitude: number;
  longitude: number;
  author: { id: UserId; username: string; avatarObjectKey: string | null };
  layer: { id: LayerId; name: string } | null;
  attachments: MapPostAttachment[];
  heartCount: number;
  isHearted: boolean;
  replyCount: number;
  createdAt: number;
};

export type Layer = {
  id: LayerId;
  name: string;
  description: string;
};

export type FeedHead = {
  id: PostId;
  createdAt: number;
};

export const getPostsWithLocation = async (
  database: AppDatabase,
  userId: UserId | null = null,
  limit?: number,
): Promise<MapPost[]> => {
  const baseQuery = database
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      visibility: schema.posts.visibility,
      latitude: schema.posts.latitude,
      longitude: schema.posts.longitude,
      createdAt: schema.posts.createdAt,
      authorId: schema.users.id,
      authorUsername: schema.users.username,
      authorAvatarObjectKey: schema.users.avatarObjectKey,
      layerId: schema.layers.id,
      layerName: schema.layers.name,
    })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        isNull(schema.posts.parentId),
      ),
    )
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .leftJoin(schema.layers, eq(schema.posts.layerId, schema.layers.id))
    .orderBy(desc(schema.posts.createdAt));

  const postRows = await (limit !== undefined ? baseQuery.limit(limit) : baseQuery).all();

  // Filter out any rows without a location (top-level posts should always have one,
  // but guard defensively since columns are nullable at the schema level).
  const locatedRows = postRows.filter(
    (r): r is typeof r & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
  );

  if (locatedRows.length === 0) {
    return [];
  }

  const postIds = locatedRows.map((r) => r.id);

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

  const heartedPostIds = new Set<string>();
  if (userId !== null) {
    const heartedRows = await database
      .select({ postId: schema.postHearts.postId })
      .from(schema.postHearts)
      .where(
        and(
          eq(schema.postHearts.userId, userId),
          inArray(schema.postHearts.postId, postIds),
        ),
      )
      .all();
    for (const r of heartedRows) {
      heartedPostIds.add(r.postId);
    }
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

  const attachmentRows = await database
    .select({
      postId: schema.attachments.postId,
      id: schema.attachments.id,
      objectKey: schema.attachments.objectKey,
      contentType: schema.attachments.contentType,
    })
    .from(schema.attachments)
    .where(inArray(schema.attachments.postId, postIds))
    .orderBy(asc(schema.attachments.displayOrder))
    .all();

  const attachmentsMap = new Map<string, MapPostAttachment[]>();
  for (const r of attachmentRows) {
    const existing = attachmentsMap.get(r.postId) ?? [];
    existing.push({ id: r.id, objectKey: r.objectKey, contentType: r.contentType });
    attachmentsMap.set(r.postId, existing);
  }

  return locatedRows.map((row) => ({
    id: row.id,
    content: row.content,
    visibility: row.visibility,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.createdAt,
    author: { id: row.authorId, username: row.authorUsername, avatarObjectKey: row.authorAvatarObjectKey },
    layer:
      row.layerId !== null && row.layerName !== null
        ? { id: row.layerId, name: row.layerName }
        : null,
    attachments: attachmentsMap.get(row.id) ?? [],
    heartCount: heartCountMap.get(row.id) ?? 0,
    isHearted: heartedPostIds.has(row.id),
    replyCount: replyCountMap.get(row.id) ?? 0,
  }));
};

export const getLayers = async (database: AppDatabase): Promise<Layer[]> => {
  const rows = await database
    .select({
      id: schema.layers.id,
      name: schema.layers.name,
      description: schema.layers.description,
    })
    .from(schema.layers)
    .all();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
  }));
};

export const findOrCreateLayerByName = async (
  database: AppDatabase,
  name: string,
): Promise<LayerId> => {
  const existing = await database
    .select({ id: schema.layers.id })
    .from(schema.layers)
    .where(eq(schema.layers.name, name))
    .get();

  if (existing !== undefined) return existing.id;

  const id = generateLayerId();
  const now = Date.now();
  await database.insert(schema.layers).values({
    id,
    name,
    description: "",
    createdAt: now,
    updatedAt: now,
  });
  return id;
};

export const getFeedHead = async (
  database: AppDatabase,
): Promise<FeedHead | null> => {
  const row = await database
    .select({
      id: schema.posts.id,
      createdAt: schema.posts.createdAt,
    })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        isNull(schema.posts.parentId),
      ),
    )
    .orderBy(desc(schema.posts.createdAt))
    .limit(1)
    .get();

  if (row === undefined) return null;
  return {
    id: row.id,
    createdAt: row.createdAt,
  };
};

export const countNewTopLevelPostsSince = async (
  database: AppDatabase,
  createdAtExclusive: number,
): Promise<number> => {
  const row = await database
    .select({ value: count() })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        isNull(schema.posts.parentId),
        gt(schema.posts.createdAt, createdAtExclusive),
      ),
    )
    .get();

  if (row === undefined) return 0;
  return row.value;
};
