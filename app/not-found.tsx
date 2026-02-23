import NotFoundPage from "@/app/components/not-found-page";

const RootNotFound = (): React.ReactElement => (
  <NotFoundPage
    title="페이지를 찾을 수 없습니다"
    description="주소를 다시 확인하거나 홈에서 원하는 페이지로 이동해 주세요."
  />
);

export default RootNotFound;
