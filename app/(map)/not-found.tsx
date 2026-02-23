import NotFoundPage from "@/app/components/not-found-page";

const MapNotFound = (): React.ReactElement => (
  <NotFoundPage
    title="사용자를 찾을 수 없습니다"
    description="요청하신 사용자 정보가 없거나 접근할 수 없습니다."
  />
);

export default MapNotFound;
