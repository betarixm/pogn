import { uuidv7 } from "uuidv7";

export type PostVisibility = "public" | "members";

export type UserId = string & { readonly __brand: "UserId" };
export type LayerId = string & { readonly __brand: "LayerId" };
export type PostId = string & { readonly __brand: "PostId" };
export type AttachmentId = string & { readonly __brand: "AttachmentId" };

export const createUserId = (value: string): UserId => value as UserId;
export const createLayerId = (value: string): LayerId => value as LayerId;
export const createPostId = (value: string): PostId => value as PostId;
export const createAttachmentId = (value: string): AttachmentId =>
  value as AttachmentId;

export const generateUserId = (): UserId => uuidv7() as UserId;
export const generateLayerId = (): LayerId => uuidv7() as LayerId;
export const generatePostId = (): PostId => uuidv7() as PostId;
export const generateAttachmentId = (): AttachmentId => uuidv7() as AttachmentId;
