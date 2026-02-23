import NotFoundPage from "@/app/components/not-found-page";

const PostNotFound = (): React.ReactElement => (
  <NotFoundPage
    title="포스트를 찾을 수 없습니다"
    description="요청하신 포스트가 삭제되었거나 존재하지 않습니다."
  />
);

export default PostNotFound;
