import type { ThreadPost } from "@/database/queries/posts";
import { PostCard } from "@/app/components/post-card";

export type ThreadListProps = React.HTMLAttributes<HTMLElement> & {
  descendants: ThreadPost[];
  isAuthenticated?: boolean;
};

export const ThreadList = ({
  descendants,
  isAuthenticated = false,
  className,
  ...props
}: ThreadListProps): React.ReactElement => (
  <section className={className} {...props}>
    <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
      스레드 {descendants.length}개
    </h2>
    {descendants.length === 0 ? (
      <p className="text-xs text-zinc-400 dark:text-zinc-600">
        아직 답글이 없습니다.
      </p>
    ) : (
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {descendants.map((post) => {
          const replyCount = descendants.filter((d) => d.parentId === post.id).length;
          return (
            <li
              key={post.id}
              className="py-3 px-4"
              style={{ paddingLeft: `${16 + (post.depth - 1) * 20}px` }}
            >
              <PostCard
                post={{
                  id: post.id,
                  author: post.author,
                  content: post.content,
                  createdAt: post.createdAt,
                  heartCount: post.heartCount,
                  isHearted: false,
                  replyCount,
                  layer: null,
                  visibility: "public",
                  attachments: post.attachments,
                }}
                variant="reply"
                isAuthenticated={isAuthenticated}
              />
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
