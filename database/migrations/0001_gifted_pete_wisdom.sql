ALTER TABLE `hearts` RENAME TO `post_hearts`;--> statement-breakpoint
CREATE TABLE `comment_hearts` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `comment_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_post_hearts` (
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_post_hearts`("user_id", "post_id", "created_at") SELECT "user_id", "post_id", "created_at" FROM `post_hearts`;--> statement-breakpoint
DROP TABLE `post_hearts`;--> statement-breakpoint
ALTER TABLE `__new_post_hearts` RENAME TO `post_hearts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;