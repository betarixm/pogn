import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { join } from "path";
import * as schema from "../../../database/schema";
import {
  createUserId,
  createPostId,
} from "../../../database/types";
import type { AppDatabase } from "../../../database/client";
import { searchPosts } from "../../../database/queries/search";

const migrationsFolder = join(import.meta.dir, "../../../database/migrations");

const createTestDatabase = (): BunSQLiteDatabase<typeof schema> => {
  const sqlite = new Database(":memory:");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder });
  return database;
};

const asAppDatabase = (
  database: BunSQLiteDatabase<typeof schema>,
): AppDatabase => database as unknown as AppDatabase;

const seedUser = (
  database: BunSQLiteDatabase<typeof schema>,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
): typeof schema.users.$inferSelect => {
  const row = {
    id: createUserId("user-1"),
    username: "testuser",
    email: "test@postech.ac.kr",
    role: "member",
    createdAt: Date.now(),
    ...overrides,
  };
  database.insert(schema.users).values(row).run();
  return row as typeof schema.users.$inferSelect;
};

const seedPost = (
  database: BunSQLiteDatabase<typeof schema>,
  authorId: typeof schema.users.$inferSelect["id"],
  overrides: Partial<typeof schema.posts.$inferInsert> = {},
): typeof schema.posts.$inferSelect => {
  const now = Date.now();
  const row = {
    id: createPostId("post-1"),
    content: "Hello world",
    latitude: 36.0,
    longitude: 129.32,
    authorId,
    layerId: null,
    parentId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    visibility: "public" as const,
    ...overrides,
  };
  database.insert(schema.posts).values(row).run();
  return row as typeof schema.posts.$inferSelect;
};

describe("searchPosts", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("returns empty array when no posts exist", async () => {
    const result = await searchPosts(asAppDatabase(database), "hello");
    expect(result).toEqual([]);
  });

  test("returns empty array for empty query", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { content: "Hello world" });

    const result = await searchPosts(asAppDatabase(database), "");
    expect(result).toEqual([]);
  });

  test("returns empty array for whitespace-only query", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { content: "Hello world" });

    const result = await searchPosts(asAppDatabase(database), "   ");
    expect(result).toEqual([]);
  });

  test("matches post by content substring", async () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "도서관 개방 시간 안내입니다.",
    });

    const result = await searchPosts(asAppDatabase(database), "도서관");
    expect(result).toContain(post.id);
  });

  test("matches single-syllable Korean term", async () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "탁구 동아리 모집합니다",
    });

    const result = await searchPosts(asAppDatabase(database), "탁");
    expect(result).toContain(post.id);
  });

  test("returns no results when query does not match any post", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "캠퍼스 행사 내용입니다.",
    });

    const result = await searchPosts(asAppDatabase(database), "도서관");
    expect(result).toEqual([]);
  });

  test("returns multiple matching posts", async () => {
    const user = seedUser(database);
    const post1 = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "도서관 1층 공사 안내",
    });
    const post2 = seedPost(database, user.id, {
      id: createPostId("post-2"),
      content: "도서관 옆 식당 메뉴입니다.",
    });
    seedPost(database, user.id, {
      id: createPostId("post-3"),
      content: "셔틀버스 운행 정보",
    });

    const result = await searchPosts(asAppDatabase(database), "도서관");
    expect(result).toContain(post1.id);
    expect(result).toContain(post2.id);
    expect(result).toHaveLength(2);
  });

  test("multi-term query requires all terms to match", async () => {
    const user = seedUser(database);
    const post1 = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "도서관 개방 시간 안내",
    });
    seedPost(database, user.id, {
      id: createPostId("post-2"),
      content: "도서관 공지 내용",
    });

    // Both "도서관" and "시간" must appear in content
    const result = await searchPosts(asAppDatabase(database), "도서관 시간");
    expect(result).toContain(post1.id);
    expect(result).not.toContain(createPostId("post-2"));
  });

  test("excludes soft-deleted posts", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "삭제된 게시글 내용",
      deletedAt: Date.now(),
    });

    const result = await searchPosts(asAppDatabase(database), "삭제된");
    expect(result).toEqual([]);
  });

  test("excludes reply posts (parentId is not null)", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, {
      id: createPostId("parent"),
      content: "부모 글",
    });
    seedPost(database, user.id, {
      id: createPostId("reply"),
      content: "부모 답글 내용",
      latitude: null,
      longitude: null,
      parentId: parent.id,
    });

    const result = await searchPosts(asAppDatabase(database), "부모");
    expect(result).toHaveLength(1);
    expect(result).toContain(parent.id);
  });

  test("treats LIKE metacharacters as literal characters", async () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "가격: 100% 할인 행사",
    });

    // '%' and '_' should be treated as literal characters, not LIKE wildcards
    const result = await searchPosts(asAppDatabase(database), "100%");
    expect(result).toContain(post.id);
  });
});
