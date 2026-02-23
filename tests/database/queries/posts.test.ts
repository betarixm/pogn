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
  createAttachmentId,
} from "../../../database/types";
import type { AppDatabase } from "../../../database/client";
import { getPostById, getPostThread, createPost } from "../../../database/queries/posts";

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

describe("getPostById", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("returns null for non-existent postId", async () => {
    const result = await getPostById(
      asAppDatabase(database),
      createPostId("does-not-exist"),
      null,
    );
    expect(result).toBeNull();
  });

  test("returns null for soft-deleted post", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { deletedAt: Date.now() });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );
    expect(result).toBeNull();
  });

  test("returns post with author and content", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { content: "Hello world" });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result).not.toBeNull();
    expect(result!.content).toBe("Hello world");
    expect(result!.author.username).toBe("testuser");
  });

  test("returns null layer when no layerId", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.layer).toBeNull();
  });

  test("returns layer when layerId is set", async () => {
    const user = seedUser(database);
    const layer = seedLayer(database);
    seedPost(database, user.id, { layerId: layer.id });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.layer?.name).toBe("Campus");
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
        {
          userId: user1.id,
          postId: createPostId("post-1"),
          createdAt: Date.now(),
        },
        {
          userId: user2.id,
          postId: createPostId("post-1"),
          createdAt: Date.now(),
        },
      ])
      .run();

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.heartCount).toBe(2);
  });

  test("returns zero heartCount when no hearts", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.heartCount).toBe(0);
  });

  test("excludes deleted replies", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("post-1") });

    const now = Date.now();
    seedPost(database, user.id, {
      id: createPostId("reply-live"),
      content: "Visible reply",
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

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.replies).toHaveLength(1);
    expect(result!.replies[0].content).toBe("Visible reply");
  });

  test("returns replies in createdAt ascending order", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("post-1") });

    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, {
      id: createPostId("reply-3"),
      content: "Third",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      createdAt: baseTime + 3000,
      updatedAt: baseTime + 3000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-1"),
      content: "First",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-2"),
      content: "Second",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.replies.map((r) => r.content)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  test("for unauthenticated user, includes only public replies", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("post-1") });
    const baseTime = 1_700_000_000_000;

    seedPost(database, user.id, {
      id: createPostId("reply-public"),
      content: "Public reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      visibility: "public",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-members"),
      content: "Members reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      visibility: "members",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.replies.map((reply) => reply.content)).toEqual(["Public reply"]);
  });

  test("for authenticated user, includes non-public replies", async () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, { id: createPostId("post-1") });
    const baseTime = 1_700_000_000_000;

    seedPost(database, user.id, {
      id: createPostId("reply-public"),
      content: "Public reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      visibility: "public",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-members"),
      content: "Members reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
      visibility: "members",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      user.id,
    );

    expect(result!.replies.map((reply) => reply.content)).toEqual([
      "Public reply",
      "Members reply",
    ]);
  });

  test("returns attachments in displayOrder ascending order", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    database
      .insert(schema.attachments)
      .values([
        {
          id: createAttachmentId("att-3"),
          postId: createPostId("post-1"),
          objectKey: "attachments/post-1/att-3/abc.pdf",
          contentType: "application/pdf",
          byteSize: 1024,
          sha256: "aaa",
          displayOrder: 3,
          createdAt: Date.now(),
        },
        {
          id: createAttachmentId("att-1"),
          postId: createPostId("post-1"),
          objectKey: "attachments/post-1/att-1/def.png",
          contentType: "image/png",
          byteSize: 2048,
          sha256: "bbb",
          displayOrder: 1,
          createdAt: Date.now(),
        },
        {
          id: createAttachmentId("att-2"),
          postId: createPostId("post-1"),
          objectKey: "attachments/post-1/att-2/ghi.jpg",
          contentType: "image/jpeg",
          byteSize: 512,
          sha256: "ccc",
          displayOrder: 2,
          createdAt: Date.now(),
        },
      ])
      .run();

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.attachments.map((a) => a.displayOrder)).toEqual([1, 2, 3]);
  });

  test("returns empty arrays when post has no replies or attachments", async () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const result = await getPostById(
      asAppDatabase(database),
      createPostId("post-1"),
      null,
    );

    expect(result!.replies).toEqual([]);
    expect(result!.attachments).toEqual([]);
  });
});

describe("createPost", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("inserts a post and returns its id", async () => {
    const user = seedUser(database);
    const layer = seedLayer(database);

    const postId = await createPost(asAppDatabase(database), {
      content: "Some content",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      layerId: layer.id,
      visibility: "public",
    });

    const rows = database.select().from(schema.posts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(postId);
    expect(rows[0].content).toBe("Some content");
  });

  test("returned post id is fetchable via getPostById", async () => {
    const user = seedUser(database);

    const postId = await createPost(asAppDatabase(database), {
      content: "World",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "public",
    });

    const result = await getPostById(asAppDatabase(database), postId, user.id);
    expect(result).not.toBeNull();
    expect(result!.content).toBe("World");
    expect(result!.author.username).toBe("testuser");
  });

  test("sets createdAt and updatedAt to current time", async () => {
    const user = seedUser(database);
    const before = Date.now();

    await createPost(asAppDatabase(database), {
      content: "Content",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "public",
    });

    const after = Date.now();
    const row = database.select().from(schema.posts).all()[0];
    expect(row.createdAt).toBeGreaterThanOrEqual(before);
    expect(row.createdAt).toBeLessThanOrEqual(after);
    expect(row.updatedAt).toBe(row.createdAt);
  });

  test("post is not soft-deleted on creation", async () => {
    const user = seedUser(database);

    await createPost(asAppDatabase(database), {
      content: "Content",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "members",
    });

    const row = database.select().from(schema.posts).all()[0];
    expect(row.deletedAt).toBeNull();
    expect(row.visibility).toBe("members");
  });

  test("each call generates a unique id", async () => {
    const user = seedUser(database);

    const id1 = await createPost(asAppDatabase(database), {
      content: "Content 1",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "public",
    });
    const id2 = await createPost(asAppDatabase(database), {
      content: "Content 2",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "public",
    });

    expect(id1).not.toBe(id2);
  });

  test("can create a reply post with parentId", async () => {
    const user = seedUser(database);
    const parentId = await createPost(asAppDatabase(database), {
      content: "Parent post",
      latitude: 36.01,
      longitude: 129.32,
      authorId: user.id,
      visibility: "public",
    });

    const replyId = await createPost(asAppDatabase(database), {
      content: "Reply post",
      authorId: user.id,
      parentId,
      visibility: "public",
    });

    const result = await getPostById(asAppDatabase(database), replyId, user.id);
    expect(result!.parentId).toBe(parentId);
    expect(result!.content).toBe("Reply post");
  });
});

describe("getPostThread", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("returns empty ancestors and descendants for a standalone post", async () => {
    const user = seedUser(database);
    seedPost(database, user.id, { id: createPostId("root") });

    const result = await getPostThread(asAppDatabase(database), createPostId("root"), false);

    expect(result.ancestors).toHaveLength(0);
    expect(result.descendants).toHaveLength(0);
  });

  test("returns direct reply as descendant at depth 1", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, { id: createPostId("root"), createdAt: baseTime, updatedAt: baseTime });
    seedPost(database, user.id, {
      id: createPostId("reply-1"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
      content: "Reply one",
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("root"), false);

    expect(result.descendants).toHaveLength(1);
    expect(result.descendants[0].id).toBe(createPostId("reply-1"));
    expect(result.descendants[0].depth).toBe(1);
    expect(result.descendants[0].content).toBe("Reply one");
  });

  test("DFS pre-order: reply-to-reply appears before sibling reply", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, { id: createPostId("root"), createdAt: baseTime, updatedAt: baseTime });
    seedPost(database, user.id, {
      id: createPostId("reply-a"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Reply A",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-a1"),
      parentId: createPostId("reply-a"),
      latitude: null,
      longitude: null,
      content: "Reply A1",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-b"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Reply B",
      createdAt: baseTime + 3000,
      updatedAt: baseTime + 3000,
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("root"), false);

    expect(result.descendants.map((d) => d.content)).toEqual(["Reply A", "Reply A1", "Reply B"]);
    expect(result.descendants.map((d) => d.depth)).toEqual([1, 2, 1]);
  });

  test("returns ancestor chain root-first when viewing a nested reply", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, { id: createPostId("root"), createdAt: baseTime, updatedAt: baseTime, content: "Root" });
    seedPost(database, user.id, {
      id: createPostId("child"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Child",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("grandchild"),
      parentId: createPostId("child"),
      latitude: null,
      longitude: null,
      content: "Grandchild",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("grandchild"), false);

    expect(result.ancestors.map((a) => a.content)).toEqual(["Root", "Child"]);
    expect(result.descendants).toHaveLength(0);
  });

  test("for unauthenticated user, excludes non-public ancestors", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, {
      id: createPostId("root"),
      content: "Members Root",
      visibility: "members",
      createdAt: baseTime,
      updatedAt: baseTime,
    });
    seedPost(database, user.id, {
      id: createPostId("child"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Public Child",
      visibility: "public",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("grandchild"),
      parentId: createPostId("child"),
      latitude: null,
      longitude: null,
      content: "Public Grandchild",
      visibility: "public",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("grandchild"), false);

    expect(result.ancestors.map((ancestor) => ancestor.content)).toEqual(["Public Child"]);
  });

  test("for authenticated user, includes non-public ancestors", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, {
      id: createPostId("root"),
      content: "Members Root",
      visibility: "members",
      createdAt: baseTime,
      updatedAt: baseTime,
    });
    seedPost(database, user.id, {
      id: createPostId("child"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Public Child",
      visibility: "public",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("grandchild"),
      parentId: createPostId("child"),
      latitude: null,
      longitude: null,
      content: "Public Grandchild",
      visibility: "public",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("grandchild"), true);

    expect(result.ancestors.map((ancestor) => ancestor.content)).toEqual([
      "Members Root",
      "Public Child",
    ]);
  });

  test("excludes soft-deleted descendants", async () => {
    const user = seedUser(database);
    const baseTime = 1_700_000_000_000;
    seedPost(database, user.id, { id: createPostId("root"), createdAt: baseTime, updatedAt: baseTime });
    seedPost(database, user.id, {
      id: createPostId("live-reply"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Live",
      createdAt: baseTime + 1000,
      updatedAt: baseTime + 1000,
    });
    seedPost(database, user.id, {
      id: createPostId("deleted-reply"),
      parentId: createPostId("root"),
      latitude: null,
      longitude: null,
      content: "Deleted",
      createdAt: baseTime + 2000,
      updatedAt: baseTime + 2000,
      deletedAt: baseTime + 3000,
    });

    const result = await getPostThread(asAppDatabase(database), createPostId("root"), false);

    expect(result.descendants).toHaveLength(1);
    expect(result.descendants[0].content).toBe("Live");
  });
});
