import { sql, and, isNull } from "drizzle-orm";
import type { SQL, AnyColumn } from "drizzle-orm";
import type { AppDatabase } from "@/database/client";
import type { PostId } from "@/database/types";
import * as schema from "@/database/schema";

// Escapes LIKE pattern metacharacters so user input is treated as a literal
// substring. The backslash is used as the LIKE escape character (declared via
// ESCAPE '\\' in the SQL). This must be kept in sync with likeContains below.
const escapeLikePattern = (term: string): string =>
  term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

// Generates: column LIKE '%term%' ESCAPE '\\'
// Drizzle's built-in like() does not support ESCAPE, so we use a raw sql tag.
const likeContains = (
  column: AnyColumn,
  term: string,
): SQL => {
  const pattern = `%${escapeLikePattern(term)}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
};

const parseSearchTerms = (input: string): string[] =>
  input.trim().split(/\s+/).filter((t) => t.length > 0);

export const searchPosts = async (
  database: AppDatabase,
  query: string,
): Promise<PostId[]> => {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return [];

  // Each term must appear in the content. Only top-level posts are searchable.
  const termConditions = terms.map(
    (term) => likeContains(schema.posts.content, term),
  );

  const rows = await database
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        isNull(schema.posts.parentId),
        ...termConditions,
      ),
    )
    .all();

  return rows.map((row) => row.id);
};
