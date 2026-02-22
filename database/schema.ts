import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type {
  UserId,
  LayerId,
  PostId,
  AttachmentId,
  PostVisibility,
} from "./types";
import {
  generateUserId,
  generateLayerId,
  generatePostId,
  generateAttachmentId,
} from "./types";

export const users = sqliteTable("users", {
  id: text("id").$type<UserId>().primaryKey().$defaultFn(generateUserId),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  avatarObjectKey: text("avatar_object_key"),
  createdAt: integer("created_at").notNull(),
});

export const layers = sqliteTable("layers", {
  id: text("id").$type<LayerId>().primaryKey().$defaultFn(generateLayerId),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").$type<PostId>().primaryKey().$defaultFn(generatePostId),
    content: text("content").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    authorId: text("author_id")
      .$type<UserId>()
      .notNull()
      .references(() => users.id),
    layerId: text("layer_id")
      .$type<LayerId>()
      .references(() => layers.id),
    parentId: text("parent_id")
      .$type<PostId>()
      .references((): AnySQLiteColumn => posts.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
    visibility: text("visibility")
      .$type<PostVisibility>()
      .notNull()
      .default("public"),
  },
  (table) => [
    index("posts_layer_id_created_at_idx").on(table.layerId, table.createdAt),
    index("posts_parent_id_created_at_idx").on(table.parentId, table.createdAt),
    check(
      "posts_latitude_range",
      sql`${table.latitude} IS NULL OR (${table.latitude} >= -90 AND ${table.latitude} <= 90)`,
    ),
    check(
      "posts_longitude_range",
      sql`${table.longitude} IS NULL OR (${table.longitude} >= -180 AND ${table.longitude} <= 180)`,
    ),
    check(
      "posts_visibility_values",
      sql`${table.visibility} IN ('public', 'members')`,
    ),
  ],
);

export const postHearts = sqliteTable(
  "post_hearts",
  {
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => users.id),
    postId: text("post_id")
      .$type<PostId>()
      .notNull()
      .references(() => posts.id),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.postId] })],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").$type<AttachmentId>().primaryKey().$defaultFn(generateAttachmentId),
    postId: text("post_id")
      .$type<PostId>()
      .notNull()
      .references(() => posts.id),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    displayOrder: integer("display_order").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("attachments_post_id_display_order_idx").on(
      table.postId,
      table.displayOrder,
    ),
  ],
);

// Better Auth tables
// camelCase property names are required — the drizzle adapter looks up fields by name.

export const authUser = sqliteTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  // additionalField set in auth config
  username: text("username"),
});

export const authSession = sqliteTable("auth_session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
});

export const authAccount = sqliteTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authVerification = sqliteTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});
