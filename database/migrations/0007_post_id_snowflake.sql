-- Migrate existing post IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- This migration rewrites post primary keys and all referencing foreign keys.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

DROP TRIGGER IF EXISTS posts_fts_delete;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS posts_fts_insert;
--> statement-breakpoint

CREATE TABLE `post_id_map` (
  `old_id` text PRIMARY KEY NOT NULL,
  `new_id` text NOT NULL UNIQUE
);
--> statement-breakpoint

WITH ranked_posts AS (
  SELECT
    `id` AS old_id,
    `created_at`,
    (ROW_NUMBER() OVER (PARTITION BY `created_at` ORDER BY `id`) - 1) AS local_sequence
  FROM `posts`
),
mapped_posts AS (
  SELECT
    old_id,
    CAST(
      (
        (
          (
            (
              CASE
                WHEN `created_at` > 1288834974657 THEN `created_at`
                ELSE 1288834974657
              END
            )
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
INSERT INTO `post_id_map` (`old_id`, `new_id`)
SELECT old_id, new_id
FROM mapped_posts;
--> statement-breakpoint

UPDATE `posts`
SET `parent_id` = (
  SELECT `new_id`
  FROM `post_id_map`
  WHERE `old_id` = `posts`.`parent_id`
)
WHERE `parent_id` IS NOT NULL;
--> statement-breakpoint

UPDATE `post_hearts`
SET `post_id` = (
  SELECT `new_id`
  FROM `post_id_map`
  WHERE `old_id` = `post_hearts`.`post_id`
);
--> statement-breakpoint

UPDATE `attachments`
SET `post_id` = (
  SELECT `new_id`
  FROM `post_id_map`
  WHERE `old_id` = `attachments`.`post_id`
);
--> statement-breakpoint

UPDATE `posts`
SET `id` = (
  SELECT `new_id`
  FROM `post_id_map`
  WHERE `old_id` = `posts`.`id`
);
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
--> statement-breakpoint

PRAGMA foreign_keys=ON;
