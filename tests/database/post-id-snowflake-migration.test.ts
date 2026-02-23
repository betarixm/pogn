import { beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsFolder = join(import.meta.dir, "../../database/migrations");

const applyMigrationFile = (sqlite: Database, filename: string): void => {
  const fullPath = join(migrationsFolder, filename);
  const sql = readFileSync(fullPath, "utf8");
  const statements = sql
    .split(/-->\s*statement-breakpoint/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    sqlite.exec(statement);
  }
};

const applyMigrationsUpTo = (sqlite: Database, maxFilename: string): void => {
  const migrationFiles = readdirSync(migrationsFolder)
    .filter((filename) => /^\d+_.+\.sql$/.test(filename))
    .sort();

  for (const filename of migrationFiles) {
    if (filename > maxFilename) continue;
    applyMigrationFile(sqlite, filename);
  }
};

describe("0007_post_id_snowflake migration", () => {
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
  });

  test("rewrites legacy post IDs and keeps references consistent", () => {
    applyMigrationsUpTo(sqlite, "0006_add_avatar_object_key.sql");

    sqlite.exec(`
      INSERT INTO users (id, username, email, role, created_at)
      VALUES ('usr_legacy', 'legacy', 'legacy@example.com', 'member', 1770000000000);

      INSERT INTO posts (id, content, latitude, longitude, author_id, layer_id, parent_id, visibility, created_at, updated_at, deleted_at)
      VALUES
        ('pst_legacy_parent', 'legacy-parent', NULL, NULL, 'usr_legacy', NULL, NULL, 'public', 1770100000000, 1770100000000, NULL),
        ('pst_legacy_reply', 'legacy-reply', NULL, NULL, 'usr_legacy', NULL, 'pst_legacy_parent', 'public', 1770100000001, 1770100000001, NULL);

      INSERT INTO post_hearts (user_id, post_id, created_at)
      VALUES ('usr_legacy', 'pst_legacy_parent', 1770100000002);

      INSERT INTO attachments (id, post_id, object_key, content_type, byte_size, sha256, display_order, created_at)
      VALUES ('att_legacy', 'pst_legacy_reply', 'posts/usr_legacy/file.jpg', 'image/jpeg', 123, 'abc', 0, 1770100000003);
    `);

    applyMigrationFile(sqlite, "0007_post_id_snowflake.sql");

    const posts = sqlite
      .query("SELECT id, content, parent_id FROM posts ORDER BY created_at ASC")
      .all() as Array<{ id: string; content: string; parent_id: string | null }>;

    expect(posts).toHaveLength(2);
    expect(posts.every((post) => /^\d+$/.test(post.id))).toBe(true);
    expect(posts.find((post) => post.id === "pst_legacy_parent")).toBeUndefined();
    expect(posts.find((post) => post.id === "pst_legacy_reply")).toBeUndefined();

    const parent = posts.find((post) => post.content === "legacy-parent");
    const reply = posts.find((post) => post.content === "legacy-reply");

    expect(parent).toBeDefined();
    expect(reply).toBeDefined();
    expect(reply?.parent_id).toBe(parent?.id ?? null);

    const postIds = new Set(posts.map((post) => post.id));

    const hearts = sqlite
      .query("SELECT post_id FROM post_hearts")
      .all() as Array<{ post_id: string }>;
    expect(hearts).toHaveLength(1);
    expect(/^\d+$/.test(hearts[0].post_id)).toBe(true);
    expect(postIds.has(hearts[0].post_id)).toBe(true);

    const attachments = sqlite
      .query("SELECT post_id FROM attachments")
      .all() as Array<{ post_id: string }>;
    expect(attachments).toHaveLength(1);
    expect(/^\d+$/.test(attachments[0].post_id)).toBe(true);
    expect(postIds.has(attachments[0].post_id)).toBe(true);

    const ftsRows = sqlite
      .query("SELECT post_id FROM posts_fts")
      .all() as Array<{ post_id: string }>;
    expect(ftsRows).toHaveLength(1);
    expect(ftsRows[0].post_id).toBe(parent?.id);
  });
});
