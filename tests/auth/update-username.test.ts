import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { eq } from "drizzle-orm";
import { join } from "path";
import * as schema from "../../database/schema";
import { createUserId } from "../../database/types";
import type { AppDatabase } from "../../database/client";
import { updateUsername } from "../../database/queries/auth";

const migrationsFolder = join(import.meta.dir, "../../database/migrations");

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
    username: "initial_name",
    email: "test@postech.ac.kr",
    role: "member",
    createdAt: Date.now(),
    ...overrides,
  };
  database.insert(schema.users).values(row).run();
  return row as typeof schema.users.$inferSelect;
};

describe("updateUsername", () => {
  let database: BunSQLiteDatabase<typeof schema>;

  beforeEach(() => {
    database = createTestDatabase();
  });

  test("updates the username for the target user", async () => {
    const user = seedUser(database);

    await updateUsername(asAppDatabase(database), user.id, "new_nickname");

    const rows = database
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .all();
    expect(rows[0].username).toBe("new_nickname");
  });

  test("does not affect other users", async () => {
    seedUser(database, { id: createUserId("user-1"), username: "first_user" });
    seedUser(database, {
      id: createUserId("user-2"),
      username: "second_user",
      email: "other@postech.ac.kr",
    });

    await updateUsername(
      asAppDatabase(database),
      createUserId("user-1"),
      "updated_name",
    );

    const rows = database.select().from(schema.users).all();
    const secondUser = rows.find((r) => r.id === createUserId("user-2"));
    expect(secondUser?.username).toBe("second_user");
  });

  test("duplicate username violates unique constraint", async () => {
    seedUser(database, {
      id: createUserId("user-1"),
      username: "taken_name",
    });
    seedUser(database, {
      id: createUserId("user-2"),
      username: "other_name",
      email: "other@postech.ac.kr",
    });

    await expect(
      updateUsername(
        asAppDatabase(database),
        createUserId("user-2"),
        "taken_name",
      ),
    ).rejects.toThrow();
  });

  test("username can be updated multiple times", async () => {
    const user = seedUser(database);

    await updateUsername(asAppDatabase(database), user.id, "first_change");
    await updateUsername(asAppDatabase(database), user.id, "second_change");

    const rows = database
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .all();
    expect(rows[0].username).toBe("second_change");
  });
});
