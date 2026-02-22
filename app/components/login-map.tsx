"use client";

import dynamic from "next/dynamic";
import type { MapPost } from "@/database/queries/map";
import type { MapInsets } from "@/app/components/post-map";

const PostMap = dynamic(() => import("@/app/components/post-map"), {
  ssr: false,
});

const NO_INSETS: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 };

type LoginMapProps = {
  posts: MapPost[];
};

const LoginMap = ({ posts }: LoginMapProps): React.ReactElement => {
  return (
    <div className="h-screen w-full">
      <PostMap
        posts={posts}
        activePostId={null}
        selectedPostId={null}
        visibleFeedPostIds={[]}
        insets={NO_INSETS}
        isFiltered={false}
        isLocationPickMode={false}
        pickedLocation={null}
        onUserMove={() => {}}
        onLocationPick={() => {}}
      />
    </div>
  );
};

export default LoginMap;
