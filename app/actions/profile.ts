"use server";

import { revalidatePath } from "next/cache";
import { uuidv7 } from "uuidv7";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { createUserId } from "@/database/types";
import { updateUserProfile } from "@/database/queries/auth";
import { getServerSession } from "@/lib/auth";

const USERNAME_PATTERN = /^[\p{L}\p{N}_]{2,20}$/u;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UpdateProfileState = { success: boolean; error?: string };

export const updateProfile = async (
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> => {
  const session = await getServerSession();
  if (session === null) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  const userId = createUserId(session.user.id);
  const updates: { username?: string; avatarObjectKey?: string } = {};

  const usernameValue = formData.get("username");
  if (typeof usernameValue === "string" && usernameValue.trim() !== "") {
    if (!USERNAME_PATTERN.test(usernameValue)) {
      return {
        success: false,
        error:
          "유효하지 않은 닉네임입니다. 2~20자, 한글·영문·숫자·_ 만 허용됩니다.",
      };
    }
    updates.username = usernameValue;
  }

  const avatarFile = formData.get("avatar");
  const hasAvatar = avatarFile instanceof File && avatarFile.size > 0;
  if (hasAvatar) {
    if (!ALLOWED_IMAGE_TYPES.has(avatarFile.type)) {
      return {
        success: false,
        error: "이미지 파일만 업로드 가능합니다 (JPEG, PNG, WebP, GIF).",
      };
    }
    if (avatarFile.size > AVATAR_MAX_BYTES) {
      return {
        success: false,
        error: "이미지 파일 크기는 5MB 이하여야 합니다.",
      };
    }
  }

  if (Object.keys(updates).length > 0 || hasAvatar) {
    const { env } = await getCloudflareContext({ async: true });

    if (hasAvatar) {
      const ext = MIME_TO_EXT[avatarFile.type] ?? "bin";
      const objectKey = `avatars/${userId}/${uuidv7()}.${ext}`;
      await env.AVATARS.put(objectKey, await avatarFile.arrayBuffer(), {
        httpMetadata: { contentType: avatarFile.type },
      });
      updates.avatarObjectKey = objectKey;
    }

    if (Object.keys(updates).length > 0) {
      const database = createDatabaseClient(env.DB);
      await updateUserProfile(database, userId, updates);
    }
  }

  revalidatePath(`/${session.user.id}`);
  return { success: true };
};
