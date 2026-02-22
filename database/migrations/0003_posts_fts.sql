CREATE VIRTUAL TABLE posts_fts USING fts5(
  post_id UNINDEXED,
  title,
  content_text,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER posts_fts_insert AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(post_id, title, content_text)
  VALUES (new.id, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER posts_fts_update AFTER UPDATE ON posts BEGIN
  DELETE FROM posts_fts WHERE post_id = old.id;
  INSERT INTO posts_fts(post_id, title, content_text)
  VALUES (new.id, new.title, new.content);
END;
--> statement-breakpoint
CREATE TRIGGER posts_fts_delete AFTER DELETE ON posts BEGIN
  DELETE FROM posts_fts WHERE post_id = old.id;
END;
--> statement-breakpoint
INSERT INTO posts_fts(post_id, title, content_text)
SELECT id, title, content FROM posts;
