-- Migrate existing user IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- Rewritten to avoid PRAGMA foreign_keys=OFF (not reliably supported across D1 batch statements).
-- Strategy: posts.author_id and post_hearts.user_id are NOT NULL, so we can't simply null them.
-- Instead: insert new user rows first (snowflake as placeholder username/email), update children
-- to point at new rows, delete old rows, then restore the real username/email values.

CREATE TABLE `user_id_map` (
  `old_id` text PRIMARY KEY NOT NULL,
  `new_id` text NOT NULL UNIQUE,
  `username` text NOT NULL,
  `email` text NOT NULL,
  `role` text NOT NULL,
  `avatar_object_key` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint

WITH ranked_users AS (
  SELECT
    `id` AS old_id,
    `username`,
    `email`,
    `role`,
    `avatar_object_key`,
    `created_at`,
    (ROW_NUMBER() OVER (PARTITION BY `created_at` ORDER BY `id`) - 1) AS local_sequence
  FROM `users`
),
mapped_users AS (
  SELECT
    old_id,
    `username`,
    `email`,
    `role`,
    `avatar_object_key`,
    `created_at`,
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
  FROM ranked_users
)
INSERT INTO `user_id_map` (`old_id`, `new_id`, `username`, `email`, `role`, `avatar_object_key`, `created_at`)
SELECT old_id, new_id, `username`, `email`, `role`, `avatar_object_key`, `created_at`
FROM mapped_users;
--> statement-breakpoint

-- Insert new user rows using snowflake ID as a placeholder for username and email.
-- Snowflake IDs are unique decimal strings, so they satisfy the UNIQUE constraint on username.
INSERT INTO `users` (`id`, `username`, `email`, `role`, `avatar_object_key`, `created_at`)
SELECT `new_id`, `new_id`, `new_id`, `role`, `avatar_object_key`, `created_at`
FROM `user_id_map`;
--> statement-breakpoint

-- Update posts.author_id to new IDs (valid: new user rows now exist).
UPDATE `posts`
SET `author_id` = (
  SELECT `new_id` FROM `user_id_map` WHERE `old_id` = `posts`.`author_id`
);
--> statement-breakpoint

-- Update post_hearts.user_id to new IDs.
UPDATE `post_hearts`
SET `user_id` = (
  SELECT `new_id` FROM `user_id_map` WHERE `old_id` = `post_hearts`.`user_id`
);
--> statement-breakpoint

-- Delete old user rows (no child rows reference them anymore).
DELETE FROM `users` WHERE `id` IN (SELECT `old_id` FROM `user_id_map`);
--> statement-breakpoint

-- Restore real username and email values.
UPDATE `users`
SET
  `username` = (SELECT `username` FROM `user_id_map` WHERE `new_id` = `users`.`id`),
  `email`    = (SELECT `email`    FROM `user_id_map` WHERE `new_id` = `users`.`id`);
--> statement-breakpoint

DROP TABLE `user_id_map`;
