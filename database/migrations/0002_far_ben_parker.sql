ALTER TABLE `posts` ADD COLUMN `visibility` text NOT NULL DEFAULT 'public' CHECK(`visibility` IN ('public', 'members'));
