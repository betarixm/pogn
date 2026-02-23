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

describe("0008_layer_id_snowflake migration", () => {
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
  });

  test("rewrites legacy layer IDs and keeps post references consistent", () => {
    applyMigrationsUpTo(sqlite, "0007_post_id_snowflake.sql");

    sqlite.exec(`
      INSERT INTO users (id, username, email, role, created_at)
      VALUES ('1772000000000000000', 'legacy', 'legacy@example.com', 'member', 1770000000000);

      INSERT INTO layers (id, name, description, created_at, updated_at)
      VALUES
        ('lyr_legacy_1', 'Layer A', 'layer-a', 1770100000000, 1770100000000),
        ('lyr_legacy_2', 'Layer B', 'layer-b', 1770100000000, 1770100000000);

      INSERT INTO posts (id, content, latitude, longitude, author_id, layer_id, parent_id, visibility, created_at, updated_at, deleted_at)
      VALUES
        ('1772100000000000000', 'post-a', 36.0, 129.0, '1772000000000000000', 'lyr_legacy_1', NULL, 'public', 1770100000001, 1770100000001, NULL),
        ('1772100000000000001', 'post-b', 36.1, 129.1, '1772000000000000000', 'lyr_legacy_2', NULL, 'public', 1770100000002, 1770100000002, NULL),
        ('1772100000000000002', 'post-no-layer', 36.2, 129.2, '1772000000000000000', NULL, NULL, 'public', 1770100000003, 1770100000003, NULL);
    `);

    applyMigrationFile(sqlite, "0008_layer_id_snowflake.sql");

    const layers = sqlite
      .query("SELECT id, name FROM layers ORDER BY name ASC")
      .all() as Array<{ id: string; name: string }>;

    expect(layers).toHaveLength(2);
    expect(layers.every((layer) => /^\d+$/.test(layer.id))).toBe(true);

    const layerIdByName = new Map(layers.map((layer) => [layer.name, layer.id]));

    const posts = sqlite
      .query("SELECT content, layer_id FROM posts ORDER BY created_at ASC")
      .all() as Array<{ content: string; layer_id: string | null }>;

    expect(posts).toHaveLength(3);

    const postA = posts.find((post) => post.content === "post-a");
    const postB = posts.find((post) => post.content === "post-b");
    const postNoLayer = posts.find((post) => post.content === "post-no-layer");

    expect(postA?.layer_id).toBe(layerIdByName.get("Layer A"));
    expect(postB?.layer_id).toBe(layerIdByName.get("Layer B"));
    expect(postNoLayer?.layer_id).toBeNull();
  });
});
