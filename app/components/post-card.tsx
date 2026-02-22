import Link from "next/link";
import type { PostId, PostVisibility, AttachmentId } from "@/database/types";
import type { PostAuthor, PostLayer } from "@/database/queries/posts";
import { PostMeta, PostBody } from "@/app/components/post-viewer";
import { ListActionBar } from "@/app/components/post-card-actions";

const formatRelativeTime = (unixMs: number): string => {
  const diffMs = Date.now() - unixMs;
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "방금";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}일 전`;
  return new Date(unixMs).toLocaleDateString("ko-KR");
};

export type PostCardAttachment = {
  id: AttachmentId;
  objectKey: string;
  contentType: string;
};

export type PostCardData = {
  id: PostId;
  author: PostAuthor;
  content: string;
  createdAt: number;
  updatedAt?: number;
  heartCount: number;
  isHearted: boolean;
  replyCount: number;
  layer: PostLayer | null;
  visibility: PostVisibility;
  attachments?: PostCardAttachment[];
};

export type PostCardProps = {
  post: PostCardData;
  variant?: "list" | "detail" | "reply";
  isFocused?: boolean;
  isAuthenticated?: boolean;
};

const mediaUrl = (objectKey: string) =>
  `/api/media?key=${encodeURIComponent(objectKey)}`;

type PhotoGridProps = {
  attachments: PostCardAttachment[];
};

const PhotoGrid = ({
  attachments,
}: PhotoGridProps): React.ReactElement | null => {
  const images = attachments.filter((a) => a.contentType.startsWith("image/"));
  if (images.length === 0) return null;
  const count = images.length;

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl ${
        count === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-0.5"
      }`}
    >
      {images.map((img, index) => (
        <div
          key={img.id}
          className={`overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${
            count === 1
              ? "aspect-video"
              : count === 3 && index === 0
                ? "row-span-2"
                : "aspect-square"
          }`}
        >
          <img
            src={mediaUrl(img.objectKey)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
};

export const PostCard = ({
  post,
  variant = "list",
  isFocused = false,
  isAuthenticated = false,
}: PostCardProps): React.ReactElement => {
  if (variant === "detail") {
    return (
      <div>
        <PostMeta
          author={post.author}
          createdAt={post.createdAt}
          updatedAt={post.updatedAt ?? post.createdAt}
          layer={post.layer}
          className="mb-3"
        />
        <PostBody content={post.content} className="text-[15px]" />
        {post.attachments && post.attachments.length > 0 && (
          <PhotoGrid attachments={post.attachments} />
        )}
        <ListActionBar
          postId={post.id}
          replyCount={post.replyCount}
          heartCount={post.heartCount}
          isHearted={post.isHearted}
          isAuthenticated={isAuthenticated}
        />
      </div>
    );
  }

  const isRestricted =
    variant === "list" && post.visibility === "members" && !isAuthenticated;
  const avatarSize = variant === "reply" ? "h-8 w-8" : "h-9 w-9";

  const body = (
    <div className="flex gap-3">
      <Link href={`/${post.author.id}`} className="relative z-10 shrink-0">
        <img
          src={
            post.author.avatarObjectKey
              ? `/api/avatar?key=${encodeURIComponent(post.author.avatarObjectKey)}`
              : "/default-avatar.png"
          }
          alt={post.author.username}
          className={`${avatarSize} rounded-full object-cover`}
        />
      </Link>

      <div className="relative z-10 min-w-0 flex-1">
        {isRestricted ? (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              포스테키안만 볼 수 있는 글입니다. 로그인 후 확인하세요.
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span
                className={`text-sm font-semibold leading-tight ${
                  variant === "list" && isFocused
                    ? "text-postech-700 dark:text-postech-300"
                    : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {post.author.username}
              </span>
              <span className="text-xs text-zinc-400">·</span>
              <time
                dateTime={new Date(post.createdAt).toISOString()}
                className="text-xs text-zinc-400"
                suppressHydrationWarning
              >
                {formatRelativeTime(post.createdAt)}
              </time>
              {post.layer !== null && variant === "list" && (
                <span className="rounded-full bg-black/6 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
                  {post.layer.name}
                </span>
              )}
            </div>

            <p
              className={`mt-0.5 whitespace-pre-wrap text-sm ${
                variant === "reply"
                  ? "leading-5 text-zinc-800 dark:text-zinc-200"
                  : isFocused
                    ? "leading-snug text-postech-700 dark:text-postech-300"
                    : "leading-snug text-zinc-800 dark:text-zinc-100"
              }`}
            >
              {post.content}
            </p>

            {post.attachments && post.attachments.length > 0 && (
              <PhotoGrid attachments={post.attachments} />
            )}

            {(variant === "list" || variant === "reply") && (
              <ListActionBar
                postId={post.id}
                replyCount={post.replyCount}
                heartCount={post.heartCount}
                isHearted={post.isHearted}
                isAuthenticated={isAuthenticated}
              />
            )}
          </>
        )}
      </div>
    </div>
  );

  if (variant === "list") {
    const cardClassName = `relative px-4 py-3 transition-colors hover:bg-white/40 dark:hover:bg-white/5 ${
      isFocused && !isRestricted
        ? "bg-postech-500/10 dark:bg-postech-400/10"
        : ""
    }`;
    return (
      <div className={cardClassName}>
        <Link
          href={
            isRestricted ? `/login?from=/posts/${post.id}` : `/posts/${post.id}`
          }
          className="absolute inset-0"
        />
        {body}
      </div>
    );
  }

  // reply variant
  return (
    <div className="relative block">
      <Link href={`/posts/${post.id}`} className="absolute inset-0" />
      {body}
    </div>
  );
};
