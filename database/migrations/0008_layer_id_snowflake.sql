-- Migrate existing layer IDs from legacy string format to Twitter-style Snowflake decimal strings.
-- Rewritten to avoid PRAGMA foreign_keys=OFF (not reliably supported across D1 batch statements).
-- Strategy: posts.layer_id is nullable, so null it out, rewrite layers.id, then restore.

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
  FROM ranked_layers
)
INSERT INTO `layer_id_map` (`old_id`, `new_id`)
SELECT old_id, new_id FROM mapped_layers;
--> statement-breakpoint

-- Stage post→layer mapping before nulling (posts.layer_id is nullable so we can clear it).
CREATE TABLE `post_layer_staging` (
  `post_id` text NOT NULL,
  `old_layer_id` text NOT NULL
);
--> statement-breakpoint

INSERT INTO `post_layer_staging` (`post_id`, `old_layer_id`)
SELECT `id`, `layer_id` FROM `posts` WHERE `layer_id` IS NOT NULL;
--> statement-breakpoint

-- Remove FK reference so layers.id can be rewritten.
UPDATE `posts` SET `layer_id` = NULL;
--> statement-breakpoint

-- Rewrite layers.id to new snowflake IDs (no FK refs outstanding).
UPDATE `layers`
SET `id` = (
  SELECT `new_id`
  FROM `layer_id_map`
  WHERE `old_id` = `layers`.`id`
);
--> statement-breakpoint

-- Restore posts.layer_id with new snowflake values.
UPDATE `posts`
SET `layer_id` = (
  SELECT l.`new_id`
  FROM `post_layer_staging` ps
  JOIN `layer_id_map` l ON l.`old_id` = ps.`old_layer_id`
  WHERE ps.`post_id` = `posts`.`id`
)
WHERE EXISTS (
  SELECT 1 FROM `post_layer_staging` WHERE `post_id` = `posts`.`id`
);
--> statement-breakpoint

DROP TABLE `post_layer_staging`;
--> statement-breakpoint

DROP TABLE `layer_id_map`;
