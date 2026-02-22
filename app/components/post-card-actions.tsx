"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle } from "lucide-react";
import type { PostId } from "@/database/types";
import { submitHeart } from "@/app/actions/posts";

type HeartState = { heartCount: number; isHearted: boolean };

type HeartButtonProps = {
  postId: PostId;
  heartCount: number;
  isHearted: boolean;
  isAuthenticated: boolean;
};

export const HeartButton = ({
  postId,
  heartCount,
  isHearted,
  isAuthenticated,
}: HeartButtonProps): React.ReactElement => {
  const [optimistic, addOptimistic] = useOptimistic<HeartState, "toggle">(
    { heartCount, isHearted },
    (state, _action) => ({
      heartCount: state.heartCount + (state.isHearted ? -1 : 1),
      isHearted: !state.isHearted,
    }),
  );
  const [isPending, startTransition] = useTransition();

  const handleClick = (event: React.MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
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
      disabled={isPending || !isAuthenticated}
      title={isAuthenticated ? undefined : "로그인 후 이용할 수 있습니다"}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${
        optimistic.isHearted
          ? "text-rose-500 dark:text-rose-400"
          : "text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400"
      }`}
    >
      <Heart
        className={`h-3.5 w-3.5 transition-all ${optimistic.isHearted ? "fill-current" : ""}`}
      />
      <span>{optimistic.heartCount}</span>
    </button>
  );
};

export type ListActionBarProps = {
  postId: PostId;
  replyCount: number;
  heartCount: number;
  isHearted: boolean;
  isAuthenticated: boolean;
};

export const ListActionBar = ({
  postId,
  replyCount,
  heartCount,
  isHearted,
  isAuthenticated,
}: ListActionBarProps): React.ReactElement => {
  const router = useRouter();
  return (
    <div className="-ml-2 mt-2 flex items-center gap-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          router.push(`/posts/${postId}`);
        }}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:text-postech-600 dark:text-zinc-500 dark:hover:text-postech-400"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>{replyCount}</span>
      </button>
      <HeartButton
        postId={postId}
        heartCount={heartCount}
        isHearted={isHearted}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
};
