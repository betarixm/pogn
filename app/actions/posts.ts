"use server";

import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPostById, createPost, togglePostHeart } from "@/database/queries/posts";
import type { PostReply } from "@/database/queries/posts";
import { findOrCreateLayerByName } from "@/database/queries/map";
import { createAttachments } from "@/database/queries/attachments";
import { searchPosts } from "@/database/queries/search";
import { createPostId, createUserId } from "@/database/types";
import type { AppDatabase } from "@/database/client";
import type { PostId, LayerId, PostVisibility } from "@/database/types";
import type { LayerSelection, AttachmentRecord } from "@/app/posts/types";
import {
  PostSubmissionError,
  ReplySubmissionError,
  HeartSubmissionError,
} from "@/app/posts/errors";
import { getServerSession } from "@/lib/auth";

export type SubmitPostInput = {
  content: string;
  latitude?: number;
  longitude?: number;
  visibility: PostVisibility;
  layerSelection?: LayerSelection | null;
  attachments?: AttachmentRecord[];
};

const resolveLayerId = async (
  database: AppDatabase,
  layerSelection: LayerSelection | null | undefined,
): Promise<LayerId | undefined> => {
  if (layerSelection == null) return undefined;
  if (layerSelection.type === "existing") return layerSelection.id;
  return findOrCreateLayerByName(database, layerSelection.name);
};

export const submitPost = async (input: SubmitPostInput): Promise<PostId> => {
  const session = await getServerSession();
  if (!session) {
    throw new PostSubmissionError("로그인이 필요합니다.");
  }
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);

  const layerId = await resolveLayerId(database, input.layerSelection);

  const postId = await createPost(database, {
    content: input.content,
    latitude: input.latitude,
    longitude: input.longitude,
    authorId: createUserId(session.user.id),
    layerId,
    visibility: input.visibility,
  });

  if (input.attachments && input.attachments.length > 0) {
    await createAttachments(database, postId, input.attachments);
  }

  revalidatePath("/posts");
  return postId;
};

export type SubmitReplyInput = {
  postId: PostId;
  content: string;
  layerSelection?: LayerSelection | null;
  attachments?: AttachmentRecord[];
};

export const submitReply = async (
  input: SubmitReplyInput,
): Promise<PostId> => {
  const session = await getServerSession();
  if (!session) {
    throw new ReplySubmissionError("로그인이 필요합니다.");
  }
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);

  // Inherit visibility from parent post
  const parentPost = await getPostById(database, input.postId, createUserId(session.user.id));
  const visibility: PostVisibility = parentPost?.visibility ?? "public";

  const layerId = await resolveLayerId(database, input.layerSelection);

  const replyId = await createPost(database, {
    content: input.content,
    authorId: createUserId(session.user.id),
    parentId: input.postId,
    layerId,
    visibility,
  });

  if (input.attachments && input.attachments.length > 0) {
    await createAttachments(database, replyId, input.attachments);
  }

  revalidatePath(`/posts/${input.postId}`);
  return replyId;
};

export const getRepliesByPostId = async (
  postId: PostId,
): Promise<PostReply[]> => {
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const post = await getPostById(database, createPostId(postId), null);
  return post?.replies ?? [];
};

export const submitHeart = async (postId: PostId): Promise<void> => {
  const session = await getServerSession();
  if (!session) {
    throw new HeartSubmissionError("로그인이 필요합니다.");
  }
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  await togglePostHeart(database, createUserId(session.user.id), postId);
  revalidatePath("/", "layout");
  revalidatePath(`/posts/${postId}`);
};

export const searchPostIds = async (query: string): Promise<PostId[]> => {
  if (query.trim().length === 0) return [];
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  try {
    return await searchPosts(database, query);
  } catch (error) {
    // D1's FTS5 can throw for edge-case queries (e.g. terms with no index
    // entries) rather than returning 0 rows as standard SQLite does.
    // Treat as no results so the UI degrades gracefully.
    console.error("[searchPostIds] FTS5 query failed", error);
    return [];
  }
};
