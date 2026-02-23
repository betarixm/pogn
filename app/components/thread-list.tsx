import type { ThreadPost } from "@/database/queries/posts";
import type { PostId } from "@/database/types";
import Post from "@/app/components/post";

export type ThreadListProps = React.HTMLAttributes<HTMLElement> & {
 descendants: ThreadPost[];
 rootPostId: PostId;
 isAuthenticated?: boolean;
};

export const ThreadList = ({
 descendants,
 rootPostId,
 isAuthenticated = false,
 className,
 ...props
}: ThreadListProps): React.ReactElement => (
 <section className={className} {...props}>
 <h2 className="mb-3 text-sm font-medium text-zinc-400">
 스레드 {descendants.length}개
 </h2>
 {descendants.length === 0 ? (
 <p className="text-xs text-zinc-600">
 아직 답글이 없습니다.
 </p>
 ) : (
 <ul className="divide-y divide-zinc-800/60">
 {descendants.map((post) => {
 const replyCount = descendants.filter((d) => d.parentId === post.id).length;
 return (
 <li
 key={post.id}
 className="py-3 px-4"
 style={{ paddingLeft: `${16 + (post.depth - 1) * 20}px` }}
 >
 <Post
 post={{
 id: post.id,
 rootPostId,
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
