"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import type { ProfileUser } from "@/database/queries/profile";
import { updateProfile, type UpdateProfileState } from "@/app/actions/profile";

type ProfilePanelProps = {
  user: ProfileUser;
  isOwner: boolean;
  postCount: number;
  replyCount: number;
};

const INITIAL_STATE: UpdateProfileState = { success: false };

const GLASS =
  "pointer-events-auto overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45";

const ProfilePanel = ({
  user,
  isOwner,
  postCount,
  replyCount,
}: ProfilePanelProps): React.ReactElement => {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.success) {
      setIsEditing(false);
      router.refresh();
    }
  }, [state.success, router]);

  const avatarUrl = user.avatarObjectKey
    ? `/api/avatar?key=${encodeURIComponent(user.avatarObjectKey)}`
    : null;
  const joinedDate = new Date(user.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });

  if (isEditing) {
    return (
      <div className={`${GLASS} shrink-0`}>
        <div className="flex items-center justify-between border-b border-black/6 px-4 py-2.5 dark:border-white/8">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            프로필 편집
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            취소
          </button>
        </div>
        <form action={formAction} className="px-4 py-4">
          {/* Avatar */}
          <div className="mb-4 flex flex-col items-center gap-2">
            <label htmlFor="profile-avatar" className="cursor-pointer">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-postech-600 text-xl font-bold text-white">
                <img
                  src={avatarUrl ?? "/default-avatar.png"}
                  alt={user.username}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.png";
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:hover:opacity-100">
                  <span className="text-xs font-medium text-white">변경</span>
                </div>
              </div>
            </label>
            <input
              id="profile-avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              클릭하여 사진 변경 · 최대 5MB
            </p>
          </div>
          {/* Username */}
          <div className="mb-3">
            <input
              name="username"
              type="text"
              required
              minLength={2}
              maxLength={20}
              defaultValue={user.username}
              placeholder="2~20자, 한글·영문·숫자·_"
              className="w-full rounded-xl border border-zinc-200/60 bg-white/50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-postech-500 focus:outline-none focus:ring-2 focus:ring-postech-500/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:placeholder-zinc-600"
            />
          </div>
          {state.error !== undefined && (
            <p className="mb-2 text-xs text-red-500">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-postech-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-postech-700 disabled:opacity-60"
          >
            {isPending ? "저장 중..." : "저장하기"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`${GLASS} shrink-0`}>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-postech-600">
              <img
                src={avatarUrl ?? "/default-avatar.png"}
                alt={user.username}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/default-avatar.png";
                }}
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                {user.username}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-400">{joinedDate} 가입</p>
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100/50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
            >
              편집
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <span>
            <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
              {postCount}
            </strong>
            <span className="ml-1 text-zinc-500">게시글</span>
          </span>
          <span>
            <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
              {replyCount}
            </strong>
            <span className="ml-1 text-zinc-500">답글</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;
