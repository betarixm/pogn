-- Migrate existing post IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- Rewritten to avoid PRAGMA foreign_keys=OFF (not reliably supported across D1 batch statements).
-- Strategy: stage child rows with new IDs pre-computed, clear FK references, rewrite PKs, restore.

DROP TRIGGER IF EXISTS posts_fts_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_insert;
--> statement-breakpoint

-- Build old_id → new_id map, carrying old_parent_id for later restoration.
CREATE TABLE `post_id_map` (
  `old_id` text PRIMARY KEY NOT NULL,
  `new_id` text NOT NULL UNIQUE,
  `old_parent_id` text
);
--> statement-breakpoint

WITH ranked_posts AS (
  SELECT
    `id` AS old_id,
    `parent_id` AS old_parent_id,
    `created_at`,
    (ROW_NUMBER() OVER (PARTITION BY `created_at` ORDER BY `id`) - 1) AS local_sequence
  FROM `posts`
),
mapped_posts AS (
  SELECT
    old_id,
    old_parent_id,
    CAST(
      (
        (
          (
            CASE
              WHEN `created_at` > 1288834974657 THEN `created_at`
              ELSE 1288834974657
            END
            + CAST(local_sequence / 4096 AS INTEGER)
          )
          - 1288834974657
        ) << 22
      )
      | (local_sequence % 4096)
      AS TEXT
    ) AS new_id
  FROM ranked_posts
)
INSERT INTO `post_id_map` (`old_id`, `new_id`, `old_parent_id`)
SELECT old_id, new_id, old_parent_id FROM mapped_posts;
--> statement-breakpoint

-- Stage post_hearts with new post_ids pre-computed (no FK constraint on staging table).
CREATE TABLE `post_hearts_staging` (
  `post_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

INSERT INTO `post_hearts_staging` (`post_id`, `user_id`, `created_at`)
SELECT
  (SELECT `new_id` FROM `post_id_map` WHERE `old_id` = `post_hearts`.`post_id`),
  `user_id`,
  `created_at`
FROM `post_hearts`;
--> statement-breakpoint

-- Stage attachments with new post_ids pre-computed.
CREATE TABLE `attachments_staging` (
  `id` text NOT NULL,
  `post_id` text NOT NULL,
  `object_key` text NOT NULL,
  `content_type` text NOT NULL,
  `byte_size` integer NOT NULL,
  `sha256` text NOT NULL,
  `display_order` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

INSERT INTO `attachments_staging` (`id`, `post_id`, `object_key`, `content_type`, `byte_size`, `sha256`, `display_order`, `created_at`)
SELECT
  `id`,
  (SELECT `new_id` FROM `post_id_map` WHERE `old_id` = `attachments`.`post_id`),
  `object_key`,
  `content_type`,
  `byte_size`,
  `sha256`,
  `display_order`,
  `created_at`
FROM `attachments`;
--> statement-breakpoint

-- Clear FK-constrained child rows (they're safely staged above).
DELETE FROM `post_hearts`;
--> statement-breakpoint

DELETE FROM `attachments`;
--> statement-breakpoint

-- Clear self-referencing FK within posts so the PK update below won't violate it.
UPDATE `posts` SET `parent_id` = NULL WHERE `parent_id` IS NOT NULL;
--> statement-breakpoint

-- Rewrite posts.id to new snowflake IDs (no outstanding FK violations now).
UPDATE `posts`
SET `id` = (
  SELECT `new_id`
  FROM `post_id_map`
  WHERE `old_id` = `posts`.`id`
);
--> statement-breakpoint

-- Restore parent_ids: for each post look up its original parent's new ID.
UPDATE `posts`
SET `parent_id` = (
  SELECT pm_parent.`new_id`
  FROM `post_id_map` pm_self
  JOIN `post_id_map` pm_parent ON pm_parent.`old_id` = pm_self.`old_parent_id`
  WHERE pm_self.`new_id` = `posts`.`id`
)
WHERE EXISTS (
  SELECT 1 FROM `post_id_map` WHERE `new_id` = `posts`.`id` AND `old_parent_id` IS NOT NULL
);
--> statement-breakpoint

-- Restore child tables with new IDs.
INSERT INTO `post_hearts` (`post_id`, `user_id`, `created_at`)
SELECT `post_id`, `user_id`, `created_at` FROM `post_hearts_staging`;
--> statement-breakpoint

INSERT INTO `attachments` (`id`, `post_id`, `object_key`, `content_type`, `byte_size`, `sha256`, `display_order`, `created_at`)
SELECT `id`, `post_id`, `object_key`, `content_type`, `byte_size`, `sha256`, `display_order`, `created_at`
FROM `attachments_staging`;
--> statement-breakpoint

DROP TABLE `post_hearts_staging`;
--> statement-breakpoint
DROP TABLE `attachments_staging`;
--> statement-breakpoint

DROP TABLE IF EXISTS `posts_fts`;
--> statement-breakpoint

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
--> statement-breakpoint

DROP TABLE `post_id_map`;
