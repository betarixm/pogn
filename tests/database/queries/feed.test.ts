import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { join } from "path";
import * as schema from "../../../database/schema";
import {
  createUserId,
  createLayerId,
  createPostId,
} from "../../../database/types";
import type { AppDatabase } from "../../../database/client";
import { getPosts } from "../../../database/queries/feed";

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

const seedLayer = (
  database: BunSQLiteDatabase<typeof schema>,
  overrides: Partial<typeof schema.layers.$inferInsert> = {},
): typeof schema.layers.$inferSelect => {
  const now = Date.now();
  const row = {
    id: createLayerId("layer-1"),
    name: "Campus",
    description: "General campus layer",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  database.insert(schema.layers).values(row).run();
  return row as typeof schema.layers.$inferSelect;
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

describe("getPosts", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("returns empty array when no posts exist", async () => {
    const result = await getPosts(asAppDatabase(database));
    expect(result).toEqual([]);
  });

  test("excludes soft-deleted posts", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { deletedAt: Date.now() });

    const result = await getPosts(asAppDatabase(database));
    expect(result).toHaveLength(0);
  });

  test("excludes reply posts (parentId is not null)", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("parent") });
    seedPost(database, user.id, {
      id: createPostId("reply"),
      parentId: parent.id,
      latitude: null,
      longitude: null,
    });

    const result = await getPosts(asAppDatabase(database));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(parent.id);
  });

  test("returns post with author", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { content: "Test content" });

    const result = await getPosts(asAppDatabase(database));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Test content");
    expect(result[0].author.username).toBe("testuser");
  });

  test("returns post with layer when layerId is set", async () => {
    const user = seedUser(database);
    const layer = seedLayer(database);
    seedPost(database, user.id, { layerId: layer.id });

    const result = await getPosts(asAppDatabase(database));

    expect(result[0].layer?.name).toBe("Campus");
  });

  test("returns null layer when no layerId", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const result = await getPosts(asAppDatabase(database));
    expect(result[0].layer).toBeNull();
  });

  test("returns posts in createdAt descending order", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;

    seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "Oldest",
      createdAt: baseTime,
      updatedAt: baseTime,
    });
    seedPost(database, user.id, {
      id: createPostId("post-2"),
      content: "Newest",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });
    seedPost(database, user.id, {
      id: createPostId("post-3"),
      content: "Middle",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });

    const result = await getPosts(asAppDatabase(database));

    expect(result.map((p) => p.content)).toEqual(["Newest", "Middle", "Oldest"]);
  });

  test("returns correct heartCount", async () => {
    const user1 = seedUser(database, {
      id: createUserId("user-1"),
      username: "user1",
    });
    const user2 = seedUser(database, {
      id: createUserId("user-2"),
      username: "user2",
      email: "user2@postech.ac.kr",
    });
    seedPost(database, user1.id);

    database
      .insert(schema.postHearts)
      .values([
        { userId: user1.id, postId: createPostId("post-1"), createdAt: Date.now() },
        { userId: user2.id, postId: createPostId("post-1"), createdAt: Date.now() },
      ])
      .run();

    const result = await getPosts(asAppDatabase(database));
    expect(result[0].heartCount).toBe(2);
  });

  test("returns zero heartCount when no hearts", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const result = await getPosts(asAppDatabase(database));
    expect(result[0].heartCount).toBe(0);
  });

  test("returns correct replyCount excluding deleted replies", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("parent") });
    const now = Date.now();

    seedPost(database, user.id, {
      id: createPostId("reply-live"),
      content: "Live reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      createdAt: now + 1000,
      updatedAt: now + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-deleted"),
      content: "Deleted reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      createdAt: now + 2000,
      updatedAt: now + 2000,
      deletedAt: now + 3000,
    });

    const result = await getPosts(asAppDatabase(database));
    expect(result[0].replyCount).toBe(1);
  });

  test("heartCount and replyCount are independent across posts", async () => {
    const user = seedUser(database);
    const now = Date.now();

    const post1 = seedPost(database, user.id, {
      id: createPostId("post-1"),
      content: "Post 1",
      createdAt: now + 1000,
      updatedAt: now + 1000,
    });
    const post2 = seedPost(database, user.id, {
      id: createPostId("post-2"),
      content: "Post 2",
      createdAt: now,
      updatedAt: now,
    });

    database
      .insert(schema.postHearts)
      .values([{ userId: user.id, postId: post1.id, createdAt: now }])
      .run();

    seedPost(database, user.id, {
      id: createPostId("reply-1"),
      content: "Reply to post 2",
      latitude: null,
      longitude: null,
      parentId: post2.id,
      createdAt: now,
      updatedAt: now,
    });

    const result = await getPosts(asAppDatabase(database));

    const resultPost1 = result.find((p) => p.content === "Post 1")!;
    const resultPost2 = result.find((p) => p.content === "Post 2")!;

    expect(resultPost1.heartCount).toBe(1);
    expect(resultPost1.replyCount).toBe(0);
    expect(resultPost2.heartCount).toBe(0);
    expect(resultPost2.replyCount).toBe(1);
  });
});
