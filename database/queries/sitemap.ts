import { eq, isNull, and, desc } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { PostId } from "@/database/types";
import * as schema from "@/database/schema";

export type SitemapPost = {
  id: PostId;
  updatedAt: number;
};

export const getPublicPostsForSitemap = async (
  database: AppDatabase,
): Promise<SitemapPost[]> => {
  return database
    .select({
      id: schema.posts.id,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        eq(schema.posts.visibility, "public"),
      ),
    )
    .orderBy(desc(schema.posts.updatedAt))
    .all();
};
