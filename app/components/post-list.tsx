"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPost } from "@/database/queries/map";
import type { PostId } from "@/database/types";
import { PostCard } from "@/app/components/post-card";

const PAGE_SIZE = 20;

type PostListProps = {
  posts: MapPost[];
  focusedPostId: PostId | null;
  isMapFiltered: boolean;
  isAuthenticated: boolean;
  onPostFocus: (postId: PostId) => void;
  onVisiblePostIdsChange: (ids: PostId[]) => void;
};

const PostList = ({
  posts,
  focusedPostId,
  isMapFiltered,
  isAuthenticated,
  onPostFocus,
  onVisiblePostIdsChange,
}: PostListProps): React.ReactElement => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleSetRef = useRef<Set<PostId>>(new Set());

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    visibleSetRef.current = new Set();
  }, [posts]);

  useEffect(() => {
    if (isMapFiltered) return;

    const root = listRef.current;
    if (root === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const postId = (entry.target as HTMLElement).dataset
            .postId as PostId;
          if (entry.isIntersecting) visibleSetRef.current.add(postId);
          else visibleSetRef.current.delete(postId);
        }

        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const postId = (visible[0].target as HTMLElement).dataset
            .postId as PostId;
          onPostFocus(postId);
        }

        onVisiblePostIdsChange([...visibleSetRef.current]);
      },
      {
        root,
        threshold: [0.25, 0.5, 0.75, 1],
        rootMargin: "-30% 0px -30% 0px",
      },
    );

    itemRefs.current.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [visibleCount, posts, isMapFiltered, onPostFocus, onVisiblePostIdsChange]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (sentinel === null || root === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, posts.length));
        }
      },
      { root, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [posts, visibleCount]);

  const visiblePosts = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  if (posts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-400 dark:text-zinc-600">
          {isMapFiltered
            ? "이 지역에 게시글이 없습니다."
            : "아직 게시글이 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <ul className="divide-y divide-white/40 dark:divide-white/6">
          {visiblePosts.map((post) => (
            <li
              key={post.id}
              ref={(el) => {
                if (el !== null) itemRefs.current.set(post.id, el);
                else itemRefs.current.delete(post.id);
              }}
              data-post-id={post.id}
            >
              <PostCard
                post={post}
                variant="list"
                isFocused={focusedPostId === post.id}
                isAuthenticated={isAuthenticated}
              />
            </li>
          ))}
        </ul>
        {hasMore && (
          <div
            ref={sentinelRef}
            className="py-3 text-center text-xs text-zinc-300 dark:text-zinc-700"
          >
            더 불러오는 중…
          </div>
        )}
      </div>
    </div>
  );
};

export default PostList;
