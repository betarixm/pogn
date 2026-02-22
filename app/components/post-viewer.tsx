import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PostAuthor, PostAttachment, PostLayer } from "@/database/queries/posts";

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


export type PostMetaProps = React.HTMLAttributes<HTMLElement> & {
  author: PostAuthor;
  createdAt: number;
  updatedAt: number;
  layer?: PostLayer | null;
};

export const PostMeta = ({
  author,
  createdAt,
  updatedAt,
  layer,
  className,
  ...props
}: PostMetaProps): React.ReactElement => {
  return (
    <div
      className={`flex items-center gap-3 ${className ?? ""}`.trim()}
      {...props}
    >
      <Link href={`/${author.id}`} className="shrink-0">
        <img
          src={
            author.avatarObjectKey
              ? `/api/avatar?key=${encodeURIComponent(author.avatarObjectKey)}`
              : "/default-avatar.png"
          }
          alt={author.username}
          className="h-10 w-10 rounded-full object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {author.username}
        </p>
        <div className="flex items-center gap-1.5">
          <time
            dateTime={new Date(createdAt).toISOString()}
            className="text-xs text-zinc-400"
            suppressHydrationWarning
          >
            {formatRelativeTime(createdAt)}
          </time>
          {updatedAt !== createdAt && (
            <span className="text-xs text-zinc-400">· 수정됨</span>
          )}
        </div>
        {layer != null && (
          <p className="text-xs text-postech-600 dark:text-postech-400">
            {layer.name}
          </p>
        )}
      </div>
    </div>
  );
};

export type PostBodyProps = React.HTMLAttributes<HTMLElement> & {
  content: string;
};

export const PostBody = ({
  content,
  className,
  ...props
}: PostBodyProps): React.ReactElement => (
  <section
    className={`prose prose-zinc dark:prose-invert max-w-none ${className ?? ""}`.trim()}
    {...props}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </section>
);

export type AttachmentListProps = React.HTMLAttributes<HTMLElement> & {
  attachments: PostAttachment[];
};

const mediaUrl = (objectKey: string) =>
  `/api/media?key=${encodeURIComponent(objectKey)}`;

export const AttachmentList = ({
  attachments,
  className,
  ...props
}: AttachmentListProps): React.ReactElement => {
  const images = attachments.filter((a) => a.contentType.startsWith("image/"));
  const count = images.length;

  if (count === 0) return <></>;

  return (
    <section
      className={`overflow-hidden rounded-xl ${className ?? ""}`.trim()}
      {...props}
    >
      <div
        className={
          count === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-0.5"
        }
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
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export type HeartCountProps = React.HTMLAttributes<HTMLElement> & {
  count: number;
};

export const HeartCount = ({
  count,
  className,
  ...props
}: HeartCountProps): React.ReactElement => (
  <span
    className={`text-sm text-zinc-600 dark:text-zinc-400 ${className ?? ""}`.trim()}
    {...props}
  >
    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
      {count}
    </span>{" "}
    좋아요
  </span>
);
