"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import type { PostId } from "@/database/types";
import { submitHeart } from "@/app/actions/posts";

type HeartState = { heartCount: number; isHearted: boolean };

type HeartButtonFloatProps = {
  postId: PostId;
  heartCount: number;
  isHearted: boolean;
  isAuthenticated: boolean;
};

const HeartButtonFloat = ({
  postId,
  heartCount,
  isHearted,
  isAuthenticated,
}: HeartButtonFloatProps): React.ReactElement => {
  const [optimistic, addOptimistic] = useOptimistic<HeartState, "toggle">(
    { heartCount, isHearted },
    (state, _action) => ({
      heartCount: state.heartCount + (state.isHearted ? -1 : 1),
      isHearted: !state.isHearted,
    }),
  );
  const [isPending, startTransition] = useTransition();

  const handleClick = (): void => {
    if (!isAuthenticated || isPending) return;
    startTransition(async () => {
      addOptimistic("toggle");
      await submitHeart(postId);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="glass pointer-events-auto flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-400/40 bg-rose-500/85 px-4 py-3 backdrop-blur-xl backdrop-saturate-200 transition-colors hover:bg-rose-500/95 disabled:cursor-not-allowed dark:border-rose-500/30 dark:bg-rose-700/75 dark:hover:bg-rose-700/90"
    >
      <Heart
        className={`h-4 w-4 transition-all ${optimistic.isHearted ? "fill-current text-white" : "text-white/90"}`}
      />
      <span className="text-sm font-semibold text-white">
        {optimistic.heartCount}
      </span>
    </button>
  );
};

export default HeartButtonFloat;
