import type { PostReply } from "@/database/queries/posts";
import Post from "@/app/components/post";

export type ReplyListProps = React.HTMLAttributes<HTMLElement> & {
 replies: PostReply[];
 isAuthenticated?: boolean;
};

export const ReplyList = ({
 replies,
 isAuthenticated = false,
 className,
 ...props
}: ReplyListProps): React.ReactElement => (
 <section className={className} {...props}>
 <h2 className="mb-3 text-sm font-medium text-zinc-400">
 답글 {replies.length}개
 </h2>
 {replies.length === 0 ? (
 <p className="text-xs text-zinc-600">
 아직 답글이 없습니다.
 </p>
 ) : (
 <ul className="space-y-1 divide-y divide-zinc-800/60">
 {replies.map((reply) => (
 <li key={reply.id} className="pt-1 first:pt-0">
 <Post
 post={{
 id: reply.id,
 author: reply.author,
 content: reply.content,
 createdAt: reply.createdAt,
 heartCount: reply.heartCount,
 isHearted: false,
 replyCount: 0,
 layer: null,
 visibility: "public",
 }}
 variant="reply"
 isAuthenticated={isAuthenticated}
 />
 </li>
 ))}
 </ul>
 )}
 </section>
);
