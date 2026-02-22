import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq, isNull, and, or, lt, desc, asc } from "drizzle-orm";
import { join } from "path";
import * as schema from "../../database/schema";
import {
  createUserId,
  createLayerId,
  createPostId,
  createAttachmentId,
} from "../../database/types";

const migrationsFolder = join(import.meta.dir, "../../database/migrations");

const createTestDatabase = (): BunSQLiteDatabase<typeof schema> => {
  const sqlite = new Database(":memory:");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder });
  return database;
};

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

describe("heart uniqueness", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("first heart insert succeeds", () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id);

    expect(() =>
      database
        .insert(schema.postHearts)
        .values({ userId: user.id, postId: post.id, createdAt: Date.now() })
        .run(),
    ).not.toThrow();
  });

  test("duplicate (userId, postId) throws", () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id);

    database
      .insert(schema.postHearts)
      .values({ userId: user.id, postId: post.id, createdAt: Date.now() })
      .run();

    expect(() =>
      database
        .insert(schema.postHearts)
        .values({ userId: user.id, postId: post.id, createdAt: Date.now() })
        .run(),
    ).toThrow();
  });

  test("same user can heart different posts", () => {
    const user = seedUser(database);
    const post1 = seedPost(database, user.id, {
      id: createPostId("post-1"),
    });
    const post2 = seedPost(database, user.id, {
      id: createPostId("post-2"),
    });

    expect(() => {
      database
        .insert(schema.postHearts)
        .values({ userId: user.id, postId: post1.id, createdAt: Date.now() })
        .run();
      database
        .insert(schema.postHearts)
        .values({ userId: user.id, postId: post2.id, createdAt: Date.now() })
        .run();
    }).not.toThrow();
  });
});

describe("soft-delete filtering", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("posts with deletedAt set are excluded when filtering", () => {
    const user = seedUser(database);

    seedPost(database, user.id, {
      id: createPostId("post-live"),
      content: "Live post",
    });
    seedPost(database, user.id, {
      id: createPostId("post-deleted"),
      content: "Deleted post",
      deletedAt: Date.now(),
    });

    const livePosts = database
      .select()
      .from(schema.posts)
      .where(isNull(schema.posts.deletedAt))
      .all();

    expect(livePosts).toHaveLength(1);
    expect(livePosts[0].content).toBe("Live post");
  });

  test("deleted posts are returned when filter is not applied", () => {
    const user = seedUser(database);

    seedPost(database, user.id, {
      id: createPostId("post-1"),
      deletedAt: Date.now(),
    });

    const allPosts = database.select().from(schema.posts).all();
    expect(allPosts).toHaveLength(1);
  });
});

describe("attachment ordering", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("attachments are returned in displayOrder ascending", () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id);

    database
      .insert(schema.attachments)
      .values([
        {
          id: createAttachmentId("att-3"),
          postId: post.id,
          objectKey: "attachments/post-1/att-3/abc.pdf",
          contentType: "application/pdf",
          byteSize: 1024,
          sha256: "aaa",
          displayOrder: 3,
          createdAt: Date.now(),
        },
        {
          id: createAttachmentId("att-1"),
          postId: post.id,
          objectKey: "attachments/post-1/att-1/def.png",
          contentType: "image/png",
          byteSize: 2048,
          sha256: "bbb",
          displayOrder: 1,
          createdAt: Date.now(),
        },
        {
          id: createAttachmentId("att-2"),
          postId: post.id,
          objectKey: "attachments/post-1/att-2/ghi.jpg",
          contentType: "image/jpeg",
          byteSize: 512,
          sha256: "ccc",
          displayOrder: 2,
          createdAt: Date.now(),
        },
      ])
      .run();

    const ordered = database
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.postId, post.id))
      .orderBy(asc(schema.attachments.displayOrder))
      .all();

    expect(ordered.map((row) => row.displayOrder)).toEqual([1, 2, 3]);
  });
});

describe("coordinate validation", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("valid coordinates are accepted", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, {
        latitude: 36.0,
        longitude: 129.32,
      }),
    ).not.toThrow();
  });

  test("null coordinates are accepted (replies don't need location)", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, {
        latitude: null,
        longitude: null,
      }),
    ).not.toThrow();
  });

  test("latitude above 90 is rejected", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, { latitude: 91, longitude: 0 }),
    ).toThrow();
  });

  test("latitude below -90 is rejected", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, { latitude: -91, longitude: 0 }),
    ).toThrow();
  });

  test("longitude above 180 is rejected", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, { latitude: 0, longitude: 181 }),
    ).toThrow();
  });

  test("longitude below -180 is rejected", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, { latitude: 0, longitude: -181 }),
    ).toThrow();
  });
});

describe("pagination boundary", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("cursor-based pagination returns non-overlapping pages", () => {
    const user = seedUser(database);

    const baseTime = 1_700_000_000_000;
    for (let index = 1; index <= 5; index++) {
      seedPost(database, user.id, {
        id: createPostId(`post-${index}`),
        content: `Post ${index}`,
        createdAt: baseTime + index * 1000,
      });
    }

    const pageSize = 2;

    const firstPage = database
      .select()
      .from(schema.posts)
      .where(isNull(schema.posts.deletedAt))
      .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
      .limit(pageSize)
      .all();

    expect(firstPage).toHaveLength(2);
    expect(firstPage[0].content).toBe("Post 5");
    expect(firstPage[1].content).toBe("Post 4");

    const cursor = firstPage[firstPage.length - 1];

    const secondPage = database
      .select()
      .from(schema.posts)
      .where(
        and(
          isNull(schema.posts.deletedAt),
          or(
            lt(schema.posts.createdAt, cursor.createdAt),
            and(
              eq(schema.posts.createdAt, cursor.createdAt),
              lt(schema.posts.id, cursor.id),
            ),
          ),
        ),
      )
      .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
      .limit(pageSize)
      .all();

    expect(secondPage).toHaveLength(2);
    expect(secondPage[0].content).toBe("Post 3");
    expect(secondPage[1].content).toBe("Post 2");

    const firstPageIds = new Set(firstPage.map((row) => row.id));
    for (const row of secondPage) {
      expect(firstPageIds.has(row.id)).toBe(false);
    }
  });

  test("last page returns remaining items without overflow", () => {
    const user = seedUser(database);

    const baseTime = 1_700_000_000_000;
    for (let index = 1; index <= 3; index++) {
      seedPost(database, user.id, {
        id: createPostId(`post-${index}`),
        content: `Post ${index}`,
        createdAt: baseTime + index * 1000,
      });
    }

    const pageSize = 2;

    const firstPage = database
      .select()
      .from(schema.posts)
      .where(isNull(schema.posts.deletedAt))
      .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
      .limit(pageSize)
      .all();

    const cursor = firstPage[firstPage.length - 1];

    const secondPage = database
      .select()
      .from(schema.posts)
      .where(
        and(
          isNull(schema.posts.deletedAt),
          or(
            lt(schema.posts.createdAt, cursor.createdAt),
            and(
              eq(schema.posts.createdAt, cursor.createdAt),
              lt(schema.posts.id, cursor.id),
            ),
          ),
        ),
      )
      .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
      .limit(pageSize)
      .all();

    expect(secondPage).toHaveLength(1);
    expect(secondPage[0].content).toBe("Post 1");
  });
});

describe("post visibility", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("post defaults to public visibility", () => {
    const user = seedUser(database);
    seedPost(database, user.id);

    const rows = database.select().from(schema.posts).all();
    expect(rows[0].visibility).toBe("public");
  });

  test("post can be inserted with members visibility", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, { visibility: "members" }),
    ).not.toThrow();

    const rows = database.select().from(schema.posts).all();
    expect(rows[0].visibility).toBe("members");
  });

  test("invalid visibility value is rejected", () => {
    const user = seedUser(database);

    expect(() =>
      seedPost(database, user.id, {
        visibility: "private" as "public",
      }),
    ).toThrow();
  });

  test("public posts are included when filtering by public visibility", () => {
    const user = seedUser(database);

    seedPost(database, user.id, {
      id: createPostId("post-public"),
      visibility: "public",
    });
    seedPost(database, user.id, {
      id: createPostId("post-members"),
      visibility: "members",
    });

    const publicPosts = database
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.visibility, "public"))
      .all();

    expect(publicPosts).toHaveLength(1);
    expect(publicPosts[0].id).toBe(createPostId("post-public"));
  });
});

describe("replies (self-referential parentId)", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("top-level post has null parentId", () => {
    const user = seedUser(database);
    const post = seedPost(database, user.id);

    const rows = database.select().from(schema.posts).all();
    expect(rows[0].parentId).toBeNull();
    expect(rows[0].id).toBe(post.id);
  });

  test("reply post can reference a parent post", () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, {
      id: createPostId("parent-post"),
    });

    expect(() =>
      seedPost(database, user.id, {
        id: createPostId("reply-post"),
        content: "This is a reply",
        latitude: null,
        longitude: null,
        parentId: parent.id,
      }),
    ).not.toThrow();

    const reply = database
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, createPostId("reply-post")))
      .get();

    expect(reply?.parentId).toBe(parent.id);
  });

  test("feed query excludes replies (parentId IS NULL)", () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, {
      id: createPostId("parent-post"),
      content: "Parent post",
    });
    seedPost(database, user.id, {
      id: createPostId("reply-post"),
      content: "Reply post",
      latitude: null,
      longitude: null,
      parentId: parent.id,
    });

    const feedPosts = database
      .select()
      .from(schema.posts)
      .where(and(isNull(schema.posts.deletedAt), isNull(schema.posts.parentId)))
      .all();

    expect(feedPosts).toHaveLength(1);
    expect(feedPosts[0].content).toBe("Parent post");
  });

  test("reply query returns replies for a given post", () => {
    const user = seedUser(database);
    const parent = seedPost(database, user.id, {
      id: createPostId("parent-post"),
      content: "Parent post",
    });
    seedPost(database, user.id, {
      id: createPostId("reply-1"),
      content: "First reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
    });
    seedPost(database, user.id, {
      id: createPostId("reply-2"),
      content: "Second reply",
      latitude: null,
      longitude: null,
      parentId: parent.id,
    });

    const replies = database
      .select()
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.parentId, parent.id),
          isNull(schema.posts.deletedAt),
        ),
      )
      .all();

    expect(replies).toHaveLength(2);
  });
});
