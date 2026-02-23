-- Migrate existing user IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- This migration rewrites user primary keys and all referencing foreign keys.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `user_id_map` (
  `old_id` text PRIMARY KEY NOT NULL,
  `new_id` text NOT NULL UNIQUE
);
--> statement-breakpoint

WITH ranked_users AS (
  SELECT
    `id` AS old_id,
    `created_at`,
    (ROW_NUMBER() OVER (PARTITION BY `created_at` ORDER BY `id`) - 1) AS local_sequence
  FROM `users`
),
mapped_users AS (
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
  FROM ranked_users
)
INSERT INTO `user_id_map` (`old_id`, `new_id`)
SELECT old_id, new_id
FROM mapped_users;
--> statement-breakpoint

UPDATE `posts`
SET `author_id` = (
  SELECT `new_id`
  FROM `user_id_map`
  WHERE `old_id` = `posts`.`author_id`
)
WHERE `author_id` IS NOT NULL;
--> statement-breakpoint

UPDATE `post_hearts`
SET `user_id` = (
  SELECT `new_id`
  FROM `user_id_map`
  WHERE `old_id` = `post_hearts`.`user_id`
)
WHERE `user_id` IS NOT NULL;
--> statement-breakpoint

UPDATE `users`
SET `id` = (
  SELECT `new_id`
  FROM `user_id_map`
  WHERE `old_id` = `users`.`id`
);
--> statement-breakpoint

DROP TABLE `user_id_map`;
--> statement-breakpoint

PRAGMA foreign_keys=ON;
