-- Migrate existing layer IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- This migration rewrites layer primary keys and referencing post foreign keys.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `layer_id_map` (
  `old_id` text PRIMARY KEY NOT NULL,
  `new_id` text NOT NULL UNIQUE
);
--> statement-breakpoint

WITH ranked_layers AS (
  SELECT
    `id` AS old_id,
    `created_at`,
    (ROW_NUMBER() OVER (PARTITION BY `created_at` ORDER BY `id`) - 1) AS local_sequence
  FROM `layers`
),
mapped_layers AS (
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
  FROM ranked_layers
)
INSERT INTO `layer_id_map` (`old_id`, `new_id`)
SELECT old_id, new_id
FROM mapped_layers;
--> statement-breakpoint

UPDATE `posts`
SET `layer_id` = (
  SELECT `new_id`
  FROM `layer_id_map`
  WHERE `old_id` = `posts`.`layer_id`
)
WHERE `layer_id` IS NOT NULL;
--> statement-breakpoint

UPDATE `layers`
SET `id` = (
  SELECT `new_id`
  FROM `layer_id_map`
  WHERE `old_id` = `layers`.`id`
);
--> statement-breakpoint

DROP TABLE `layer_id_map`;
--> statement-breakpoint

PRAGMA foreign_keys=ON;
