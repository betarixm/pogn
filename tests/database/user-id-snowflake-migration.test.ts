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

describe("0009_user_id_snowflake migration", () => {
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
  });

  test("rewrites legacy user IDs and keeps post references consistent", () => {
    applyMigrationsUpTo(sqlite, "0008_layer_id_snowflake.sql");

    sqlite.exec(`
      INSERT INTO users (id, username, email, role, created_at)
      VALUES
        ('usr_legacy_a', 'legacy-a', 'legacy-a@example.com', 'member', 1770000000000),
        ('usr_legacy_b', 'legacy-b', 'legacy-b@example.com', 'member', 1770000000000);

      INSERT INTO layers (id, name, description, created_at, updated_at)
      VALUES ('1772200000000000000', 'Layer', 'layer', 1770100000000, 1770100000000);

      INSERT INTO posts (id, content, latitude, longitude, author_id, layer_id, parent_id, visibility, created_at, updated_at, deleted_at)
      VALUES
        ('1772300000000000000', 'post-a', NULL, NULL, 'usr_legacy_a', '1772200000000000000', NULL, 'public', 1770100000001, 1770100000001, NULL),
        ('1772300000000000001', 'post-b', NULL, NULL, 'usr_legacy_b', '1772200000000000000', NULL, 'public', 1770100000002, 1770100000002, NULL);

      INSERT INTO post_hearts (user_id, post_id, created_at)
      VALUES
        ('usr_legacy_a', '1772300000000000000', 1770100000003),
        ('usr_legacy_b', '1772300000000000000', 1770100000004);
    `);

    applyMigrationFile(sqlite, "0009_user_id_snowflake.sql");

    const users = sqlite
      .query("SELECT id, username FROM users ORDER BY username ASC")
      .all() as Array<{ id: string; username: string }>;

    expect(users).toHaveLength(2);
    expect(users.every((user) => /^\d+$/.test(user.id))).toBe(true);

    const userIdByUsername = new Map(users.map((user) => [user.username, user.id]));

    const posts = sqlite
      .query("SELECT content, author_id FROM posts ORDER BY created_at ASC")
      .all() as Array<{ content: string; author_id: string }>;

    expect(posts).toHaveLength(2);

    const postA = posts.find((post) => post.content === "post-a");
    const postB = posts.find((post) => post.content === "post-b");

    expect(postA?.author_id).toBe(userIdByUsername.get("legacy-a"));
    expect(postB?.author_id).toBe(userIdByUsername.get("legacy-b"));

    const userIds = new Set(users.map((user) => user.id));

    const hearts = sqlite
      .query("SELECT user_id FROM post_hearts ORDER BY created_at ASC")
      .all() as Array<{ user_id: string }>;

    expect(hearts).toHaveLength(2);
    expect(hearts.every((heart) => /^\d+$/.test(heart.user_id))).toBe(true);
    expect(hearts.every((heart) => userIds.has(heart.user_id))).toBe(true);
  });
});
