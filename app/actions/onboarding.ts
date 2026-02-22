"use server";

import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { createUserId } from "@/database/types";
import { updateUsername } from "@/database/queries/auth";
import { getServerSession } from "@/lib/auth";

const USERNAME_PATTERN = /^[\p{L}\p{N}_]{2,20}$/u;

export const setUsername = async (formData: FormData): Promise<void> => {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const username = formData.get("username");
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    throw new Error("유효하지 않은 닉네임입니다. 2~20자, 한글·영문·숫자·_ 만 허용됩니다.");
  }

  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  await updateUsername(database, createUserId(session.user.id), username);

  redirect("/posts");
};
