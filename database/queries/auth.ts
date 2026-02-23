import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { UserId } from "@/database/types";
import * as schema from "@/database/schema";

export const updateUsername = async (
  database: AppDatabase,
  userId: UserId,
  username: string,
): Promise<void> => {
  await database
    .update(schema.users)
    .set({ username })
    .where(eq(schema.users.id, userId));
};

export const getUserById = async (
  database: AppDatabase,
  userId: UserId,
): Promise<typeof schema.users.$inferSelect | undefined> => {
  const rows = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return rows[0];
};

export const getUserByEmail = async (
  database: AppDatabase,
  email: string,
): Promise<typeof schema.users.$inferSelect | undefined> => {
  const rows = await database
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));
  return rows[0];
};

export type UserProfileUpdates = {
  username?: string;
  avatarObjectKey?: string;
};

export const updateUserProfile = async (
  database: AppDatabase,
  userId: UserId,
  updates: UserProfileUpdates,
): Promise<void> => {
  await database
    .update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, userId));
};
