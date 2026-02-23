import { eq, isNull, and, asc, count, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type {
  PostId,
  UserId,
  LayerId,
  AttachmentId,
  PostVisibility,
} from "@/database/types";
import { generatePostId } from "@/database/types";
import * as schema from "@/database/schema";

export type PostAuthor = {
  id: UserId;
  username: string;
  avatarObjectKey: string | null;
};

export type PostLayer = {
  id: LayerId;
  name: string;
};

export type PostReply = {
  id: PostId;
  author: PostAuthor;
  content: string;
  heartCount: number;
  createdAt: number;
};

export type PostAttachment = {
  id: AttachmentId;
  objectKey: string;
  contentType: string;
  byteSize: number;
  displayOrder: number;
};

export type PostDetail = {
  id: PostId;
  visibility: PostVisibility;
  content: string;
  latitude: number | null;
  longitude: number | null;
  author: PostAuthor;
  layer: PostLayer | null;
  parentId: PostId | null;
  heartCount: number;
  isHearted: boolean;
  replies: PostReply[];
  attachments: PostAttachment[];
  createdAt: number;
  updatedAt: number;
};

export type AncestorPost = {
  id: PostId;
  content: string;
  author: PostAuthor;
  createdAt: number;
};

export type ThreadPost = {
  id: PostId;
  parentId: PostId | null;
  content: string;
  author: PostAuthor;
  heartCount: number;
  depth: number;
  createdAt: number;
  attachments: PostAttachment[];
};

export type PostThread = {
  ancestors: AncestorPost[];
  descendants: ThreadPost[];
};

export type CreatePostInput = {
  content: string;
  latitude?: number;
  longitude?: number;
  authorId: UserId;
  layerId?: LayerId;
  parentId?: PostId;
  visibility: PostVisibility;
};

export const createPost = async (
  database: AppDatabase,
  input: CreatePostInput,
): Promise<PostId> => {
  const now = Date.now();
  const id = generatePostId();
  await database.insert(schema.posts).values({
    id,
    content: input.content,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    authorId: input.authorId,
    layerId: input.layerId ?? null,
    parentId: input.parentId ?? null,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
  });
  return id;
};

export const togglePostHeart = async (
  database: AppDatabase,
  userId: UserId,
  postId: PostId,
): Promise<void> => {
  const existing = await database
    .select({ userId: schema.postHearts.userId })
    .from(schema.postHearts)
    .where(and(eq(schema.postHearts.userId, userId), eq(schema.postHearts.postId, postId)))
    .get();

  if (existing !== undefined) {
    await database
      .delete(schema.postHearts)
      .where(and(eq(schema.postHearts.userId, userId), eq(schema.postHearts.postId, postId)));
  } else {
    await database
      .insert(schema.postHearts)
      .values({ userId, postId, createdAt: Date.now() });
  }
};

export const getPostById = async (
  database: AppDatabase,
  postId: PostId,
  userId: UserId | null,
): Promise<PostDetail | null> => {
  const visibilityCondition = userId !== null
    ? and(eq(schema.posts.id, postId), isNull(schema.posts.deletedAt))
    : and(
        eq(schema.posts.id, postId),
        isNull(schema.posts.deletedAt),
        eq(schema.posts.visibility, "public"),
      );

  const row = await database
    .select({
      id: schema.posts.id,
      visibility: schema.posts.visibility,
      content: schema.posts.content,
      latitude: schema.posts.latitude,
      longitude: schema.posts.longitude,
      parentId: schema.posts.parentId,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt,
      authorId: schema.users.id,
      authorUsername: schema.users.username,
      authorAvatarObjectKey: schema.users.avatarObjectKey,
      layerId: schema.layers.id,
      layerName: schema.layers.name,
    })
    .from(schema.posts)
    .where(visibilityCondition)
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .leftJoin(schema.layers, eq(schema.posts.layerId, schema.layers.id))
    .get();

  if (row === undefined) {
    return null;
  }

  const heartCountRow = await database
    .select({ value: count() })
    .from(schema.postHearts)
    .where(eq(schema.postHearts.postId, postId))
    .get();

  const isHeartedRow = userId !== null
    ? await database
        .select({ userId: schema.postHearts.userId })
        .from(schema.postHearts)
        .where(and(eq(schema.postHearts.postId, postId), eq(schema.postHearts.userId, userId)))
        .get()
    : undefined;

  const replyVisibilityCondition = userId !== null
    ? and(
        eq(schema.posts.parentId, postId),
        isNull(schema.posts.deletedAt),
      )
    : and(
        eq(schema.posts.parentId, postId),
        isNull(schema.posts.deletedAt),
        eq(schema.posts.visibility, "public"),
      );

  const replyRows = await database
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      createdAt: schema.posts.createdAt,
      authorId: schema.users.id,
      authorUsername: schema.users.username,
      authorAvatarObjectKey: schema.users.avatarObjectKey,
    })
    .from(schema.posts)
    .where(replyVisibilityCondition)
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .orderBy(asc(schema.posts.createdAt))
    .all();

  const attachmentRows = await database
    .select({
      id: schema.attachments.id,
      objectKey: schema.attachments.objectKey,
      contentType: schema.attachments.contentType,
      byteSize: schema.attachments.byteSize,
      displayOrder: schema.attachments.displayOrder,
    })
    .from(schema.attachments)
    .where(eq(schema.attachments.postId, postId))
    .orderBy(asc(schema.attachments.displayOrder))
    .all();

  const replyIds = replyRows.map((r) => r.id);
  const replyHeartCountMap = new Map<string, number>();
  if (replyIds.length > 0) {
    const replyHeartRows = await database
      .select({
        postId: schema.postHearts.postId,
        value: count(),
      })
      .from(schema.postHearts)
      .where(inArray(schema.postHearts.postId, replyIds))
      .groupBy(schema.postHearts.postId)
      .all();
    for (const r of replyHeartRows) {
      replyHeartCountMap.set(r.postId, r.value);
    }
  }

  return {
    id: row.id,
    visibility: row.visibility,
    content: row.content,
    latitude: row.latitude,
    longitude: row.longitude,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: { id: row.authorId, username: row.authorUsername, avatarObjectKey: row.authorAvatarObjectKey },
    layer:
      row.layerId !== null && row.layerName !== null
        ? { id: row.layerId, name: row.layerName }
        : null,
    heartCount: heartCountRow?.value ?? 0,
    isHearted: isHeartedRow !== undefined,
    replies: replyRows.map((replyRow) => ({
      id: replyRow.id,
      author: { id: replyRow.authorId, username: replyRow.authorUsername, avatarObjectKey: replyRow.authorAvatarObjectKey },
      content: replyRow.content,
      heartCount: replyHeartCountMap.get(replyRow.id) ?? 0,
      createdAt: replyRow.createdAt,
    })),
    attachments: attachmentRows.map((attachmentRow) => ({
      id: attachmentRow.id,
      objectKey: attachmentRow.objectKey,
      contentType: attachmentRow.contentType,
      byteSize: attachmentRow.byteSize,
      displayOrder: attachmentRow.displayOrder,
    })),
  };
};

const MAX_ANCESTOR_DEPTH = 20;

export const getPostThread = async (
  database: AppDatabase,
  postId: PostId,
  isAuthenticated: boolean,
): Promise<PostThread> => {
  // Walk up the parent chain to collect ancestor IDs (root-first order)
  const ancestorIds: PostId[] = [];
  let current: PostId = postId;
  for (let i = 0; i < MAX_ANCESTOR_DEPTH; i++) {
    const row = await database
      .select({ parentId: schema.posts.parentId })
      .from(schema.posts)
      .where(eq(schema.posts.id, current))
      .get();
    if (row === undefined || row.parentId === null) break;
    current = row.parentId;
    ancestorIds.unshift(current);
  }

  // Fetch ancestor data preserving root-first order
  let ancestors: AncestorPost[] = [];
  if (ancestorIds.length > 0) {
    const ancestorVisibilityCondition = isAuthenticated
      ? and(inArray(schema.posts.id, ancestorIds), isNull(schema.posts.deletedAt))
      : and(
          inArray(schema.posts.id, ancestorIds),
          isNull(schema.posts.deletedAt),
          eq(schema.posts.visibility, "public"),
        );

    const ancestorRows = await database
      .select({
        id: schema.posts.id,
        content: schema.posts.content,
        createdAt: schema.posts.createdAt,
        authorId: schema.users.id,
        authorUsername: schema.users.username,
        authorAvatarObjectKey: schema.users.avatarObjectKey,
      })
      .from(schema.posts)
      .where(ancestorVisibilityCondition)
      .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .all();
    const ancestorMap = new Map(ancestorRows.map((r) => [r.id, r]));
    ancestors = ancestorIds
      .map((id) => ancestorMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .map((r) => ({
        id: r.id,
        content: r.content,
        author: { id: r.authorId, username: r.authorUsername, avatarObjectKey: r.authorAvatarObjectKey },
        createdAt: r.createdAt,
      }));
  }

  // BFS from postId downward to collect all descendant IDs
  const allDescendantIds = new Set<PostId>();
  let frontier: PostId[] = [postId];
  while (frontier.length > 0) {
    const childRows = await database
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(and(inArray(schema.posts.parentId, frontier), isNull(schema.posts.deletedAt)))
      .all();
    frontier = childRows.map((r) => r.id).filter((id) => !allDescendantIds.has(id));
    for (const id of frontier) allDescendantIds.add(id);
  }

  if (allDescendantIds.size === 0) {
    return { ancestors, descendants: [] };
  }

  // Fetch all descendant post data
  const visibilityCondition = isAuthenticated
    ? and(inArray(schema.posts.id, [...allDescendantIds]), isNull(schema.posts.deletedAt))
    : and(
        inArray(schema.posts.id, [...allDescendantIds]),
        isNull(schema.posts.deletedAt),
        eq(schema.posts.visibility, "public"),
      );

  const descendantRows = await database
    .select({
      id: schema.posts.id,
      parentId: schema.posts.parentId,
      content: schema.posts.content,
      createdAt: schema.posts.createdAt,
      authorId: schema.users.id,
      authorUsername: schema.users.username,
      authorAvatarObjectKey: schema.users.avatarObjectKey,
    })
    .from(schema.posts)
    .where(visibilityCondition)
    .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
    .all();

  // Fetch heart counts for all descendants
  const heartRows =
    descendantRows.length > 0
      ? await database
          .select({ postId: schema.postHearts.postId, value: count() })
          .from(schema.postHearts)
          .where(inArray(schema.postHearts.postId, descendantRows.map((r) => r.id)))
          .groupBy(schema.postHearts.postId)
          .all()
      : [];
  const heartCountMap = new Map(heartRows.map((r) => [r.postId, r.value]));

  // Fetch attachments for all descendants
  const descendantAttachmentRows =
    descendantRows.length > 0
      ? await database
          .select({
            id: schema.attachments.id,
            postId: schema.attachments.postId,
            objectKey: schema.attachments.objectKey,
            contentType: schema.attachments.contentType,
            byteSize: schema.attachments.byteSize,
            displayOrder: schema.attachments.displayOrder,
          })
          .from(schema.attachments)
          .where(inArray(schema.attachments.postId, descendantRows.map((r) => r.id)))
          .orderBy(asc(schema.attachments.displayOrder))
          .all()
      : [];
  const attachmentsByPostId = new Map<PostId, PostAttachment[]>();
  for (const row of descendantAttachmentRows) {
    if (!attachmentsByPostId.has(row.postId)) attachmentsByPostId.set(row.postId, []);
    attachmentsByPostId.get(row.postId)!.push({
      id: row.id,
      objectKey: row.objectKey,
      contentType: row.contentType,
      byteSize: row.byteSize,
      displayOrder: row.displayOrder,
    });
  }

  // Build parent→children map, sorted by createdAt
  const childrenMap = new Map<PostId, typeof descendantRows>();
  for (const row of descendantRows) {
    if (row.parentId === null) continue;
    if (!childrenMap.has(row.parentId)) childrenMap.set(row.parentId, []);
    childrenMap.get(row.parentId)!.push(row);
  }
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.createdAt - b.createdAt);
  }

  // DFS pre-order traversal starting from postId's direct children
  const descendantMap = new Map(descendantRows.map((r) => [r.id, r]));
  const descendants: ThreadPost[] = [];
  const stack: Array<{ id: PostId; depth: number }> = [];
  const directChildren = childrenMap.get(postId) ?? [];
  for (let i = directChildren.length - 1; i >= 0; i--) {
    stack.push({ id: directChildren[i].id, depth: 1 });
  }
  while (stack.length > 0) {
    const { id, depth } = stack.pop()!;
    const row = descendantMap.get(id);
    if (row === undefined) continue;
    descendants.push({
      id: row.id,
      parentId: row.parentId,
      content: row.content,
      author: { id: row.authorId, username: row.authorUsername, avatarObjectKey: row.authorAvatarObjectKey },
      heartCount: heartCountMap.get(row.id) ?? 0,
      depth,
      createdAt: row.createdAt,
      attachments: attachmentsByPostId.get(row.id) ?? [],
    });
    const children = childrenMap.get(id) ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ id: children[i].id, depth: depth + 1 });
    }
  }

  return { ancestors, descendants };
};
