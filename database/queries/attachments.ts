import type { AppDatabase } from "@/database/client";
import type { PostId } from "@/database/types";
import { generateAttachmentId } from "@/database/types";
import type { AttachmentRecord } from "@/app/posts/types";
import * as schema from "@/database/schema";

export const createAttachments = async (
  database: AppDatabase,
  postId: PostId,
  attachments: AttachmentRecord[],
): Promise<void> => {
  if (attachments.length === 0) return;
  const now = Date.now();
  for (const attachment of attachments) {
    await database.insert(schema.attachments).values({
      id: generateAttachmentId(),
      postId,
      objectKey: attachment.objectKey,
      contentType: attachment.contentType,
      byteSize: attachment.byteSize,
      sha256: attachment.sha256,
      displayOrder: attachment.displayOrder,
      createdAt: now,
    });
  }
};
