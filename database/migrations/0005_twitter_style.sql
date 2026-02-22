-- Twitter-style transformation: remove titles, add self-referential replies,
-- drop comments/comment_hearts tables, rebuild FTS without title column.

-- Drop FTS triggers and table (must be before posts table rebuild)
DROP TRIGGER IF EXISTS posts_fts_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_insert;
--> statement-breakpoint
DROP TABLE IF EXISTS posts_fts;
--> statement-breakpoint

-- Drop comment infrastructure
DROP TABLE IF EXISTS `comment_hearts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `comments`;
--> statement-breakpoint

-- Disable FK enforcement while rebuilding posts (post_hearts and attachments reference it)
PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- Recreate posts table with new schema (drop title, nullable lat/lng/layer_id, add parent_id)
CREATE TABLE `posts_new` (
  `id` text PRIMARY KEY NOT NULL,
  `content` text NOT NULL,
  `latitude` real,
  `longitude` real,
  `author_id` text NOT NULL REFERENCES `users`(`id`),
  `layer_id` text REFERENCES `layers`(`id`),
  `parent_id` text REFERENCES `posts`(`id`),
  `visibility` text NOT NULL DEFAULT 'public',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  CHECK (`latitude` IS NULL OR (`latitude` >= -90 AND `latitude` <= 90)),
  CHECK (`longitude` IS NULL OR (`longitude` >= -180 AND `longitude` <= 180)),
  CHECK (`visibility` IN ('public', 'members'))
);
--> statement-breakpoint
INSERT INTO `posts_new` (`id`, `content`, `latitude`, `longitude`, `author_id`, `layer_id`, `parent_id`, `visibility`, `created_at`, `updated_at`, `deleted_at`)
SELECT `id`, `content`, `latitude`, `longitude`, `author_id`, `layer_id`, NULL, `visibility`, `created_at`, `updated_at`, `deleted_at`
FROM `posts`;
--> statement-breakpoint
DROP TABLE `posts`;
--> statement-breakpoint
ALTER TABLE `posts_new` RENAME TO `posts`;
--> statement-breakpoint
CREATE INDEX `posts_layer_id_created_at_idx` ON `posts` (`layer_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `posts_parent_id_created_at_idx` ON `posts` (`parent_id`, `created_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint

-- Also drop post_hearts FK violation safeguard: post_hearts already references posts(id),
-- which is fine after the rename since the table keeps the same name.

-- Recreate FTS (content only, top-level posts only via trigger WHEN clause)
CREATE VIRTUAL TABLE `posts_fts` USING fts5(
  post_id UNINDEXED,
  content_text,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER `posts_fts_insert` AFTER INSERT ON `posts`
WHEN new.`parent_id` IS NULL
BEGIN
  INSERT INTO `posts_fts`(`post_id`, `content_text`) VALUES (new.`id`, new.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER `posts_fts_update` AFTER UPDATE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `post_id` = old.`id`;
  INSERT INTO `posts_fts`(`post_id`, `content_text`)
  SELECT new.`id`, new.`content` WHERE new.`parent_id` IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `posts_fts_delete` AFTER DELETE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE `post_id` = old.`id`;
END;
--> statement-breakpoint
INSERT INTO `posts_fts`(`post_id`, `content_text`)
SELECT `id`, `content` FROM `posts` WHERE `parent_id` IS NULL AND `deleted_at` IS NULL;
