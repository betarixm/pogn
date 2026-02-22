import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "포근", template: "%s / 포근" },
  description: "포스텍 근처의 포근",
  alternates: {
    canonical: "/posts",
  },
  openGraph: {
    title: "포근",
    description: "포스텍 근처의 포근",
    url: "/posts",
  },
};

type PostsLayoutProps = {
  children: React.ReactNode;
};

const PostsLayout = ({
  children,
}: PostsLayoutProps): React.ReactElement => {
  return <>{children}</>;
};

export default PostsLayout;
