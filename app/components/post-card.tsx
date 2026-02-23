import Post from "@/app/components/post";
import type { PostProps, PostData, PostAttachment } from "@/app/components/post";

export type PostCardAttachment = PostAttachment;
export type PostCardData = PostData;
export type PostCardProps = PostProps;

export const PostCard = (props: PostCardProps): React.ReactElement => {
  return <Post {...props} />;
};
