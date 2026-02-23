"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Heart, MessageCircle } from "lucide-react";
import type { PostId } from "@/database/types";
import { submitHeart } from "@/app/actions/posts";

type HeartState = { heartCount: number; isHearted: boolean };

type HeartButtonProps = {
 postId: PostId;
 heartCount: number;
 isHearted: boolean;
 isAuthenticated: boolean;
 disable: boolean;
};

const HeartButton = ({
 postId,
 heartCount,
 isHearted,
 isAuthenticated,
 disable,
}: HeartButtonProps): React.ReactElement => {
 const prefersReducedMotion = useReducedMotion();
 const [optimistic, addOptimistic] = useOptimistic<HeartState, "toggle">(
 { heartCount, isHearted },
 (state) => ({
 heartCount: state.heartCount + (state.isHearted ? -1 : 1),
 isHearted: !state.isHearted,
 }),
 );
 const [isPending, startTransition] = useTransition();

 const handleClick = (event: React.MouseEvent): void => {
 event.preventDefault();
 event.stopPropagation();
 if (!isAuthenticated || disable || isPending) return;
 startTransition(async () => {
 addOptimistic("toggle");
 await submitHeart(postId);
 });
 };

 return (
 <motion.button
 type="button"
 onClick={handleClick}
 disabled={isPending || disable || !isAuthenticated}
 title={isAuthenticated ? undefined : "로그인 후 이용할 수 있습니다"}
 whileHover={
 prefersReducedMotion
 ? undefined
 : { y: -1, scale: optimistic.isHearted ? 1.02 : 1.035 }
 }
 whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed ${
 optimistic.isHearted
 ? "text-rose-500 text-rose-400"
 : "text-zinc-400 hover:text-rose-500 text-zinc-500 hover:text-rose-400"
 }`}
 >
 <motion.span
 animate={
 prefersReducedMotion
 ? undefined
 : optimistic.isHearted
 ? { scale: [1, 1.18, 1], rotate: [0, -8, 0] }
 : { scale: 1, rotate: 0 }
 }
 transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
 >
 <Heart
 className={`h-3.5 w-3.5 transition-all ${optimistic.isHearted ? "fill-current" : ""}`}
 />
 </motion.span>
 <span>{optimistic.heartCount}</span>
 </motion.button>
 );
};

export type PostActionsProps = {
 postId: PostId;
 replyCount: number;
 heartCount: number;
 isHearted: boolean;
 isAuthenticated: boolean;
 disable?: boolean;
 className?: string;
};

const PostActions = ({
 postId,
 replyCount,
 heartCount,
 isHearted,
 isAuthenticated,
 disable = false,
 className,
}: PostActionsProps): React.ReactElement => {
 const prefersReducedMotion = useReducedMotion();
 const router = useRouter();

 return (
 <div className={`-ml-2 mt-2 flex items-center gap-0 ${className ?? ""}`.trim()}>
 <motion.button
 type="button"
 disabled={disable}
 onClick={(event) => {
 event.preventDefault();
 event.stopPropagation();
 if (disable) return;
 router.push(`/posts/${postId}`);
 }}
 whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.035 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:text-postech-600 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-500 hover:text-postech-400"
 >
 <motion.span
 animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
 transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
 >
 <MessageCircle className="h-3.5 w-3.5" />
 </motion.span>
 <span>{replyCount}</span>
 </motion.button>
 <HeartButton
 postId={postId}
 heartCount={heartCount}
 isHearted={isHearted}
 isAuthenticated={isAuthenticated}
 disable={disable}
 />
 </div>
 );
};

export default PostActions;
