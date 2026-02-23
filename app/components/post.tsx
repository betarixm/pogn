"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import type { PostId, PostVisibility, AttachmentId } from "@/database/types";
import type { PostAuthor, PostLayer } from "@/database/queries/posts";
import Avatar from "@/app/components/avatar";
import PostContent from "@/app/components/post-content";
import PostActions from "@/app/components/post-actions";

const formatRelativeTime = (unixMs: number): string => {
 const diffMs = Date.now() - unixMs;
 const diffMinutes = Math.floor(diffMs / 60_000);
 if (diffMinutes < 1) return "방금";
 if (diffMinutes < 60) return `${diffMinutes}분 전`;
 const diffHours = Math.floor(diffMinutes / 60);
 if (diffHours < 24) return `${diffHours}시간 전`;
 const diffDays = Math.floor(diffHours / 24);
 if (diffDays < 30) return `${diffDays}일 전`;
 return new Date(unixMs).toLocaleDateString("ko-KR");
};

export type PostAttachment = {
 id: AttachmentId;
 objectKey: string;
 contentType: string;
};

export type PostData = {
 id: PostId;
 author: PostAuthor;
 content: string;
 createdAt: number;
 updatedAt?: number;
 heartCount: number;
 isHearted: boolean;
 replyCount: number;
 layer: PostLayer | null;
 visibility: PostVisibility;
 attachments?: PostAttachment[];
};

export type PostProps = {
 post: PostData;
 variant?: "list" | "detail" | "reply";
 isFocused?: boolean;
 isAuthenticated?: boolean;
};

const mediaUrl = (objectKey: string): string =>
  `/api/media?key=${encodeURIComponent(objectKey)}`;

const INTERACTIVE_ELEMENT_SELECTOR =
  "a, button, input, textarea, select, label, summary";

type PhotoGridProps = {
  attachments: PostAttachment[];
  onOpenImage: (index: number) => void;
};

const PhotoGrid = ({
  attachments,
  onOpenImage,
}: PhotoGridProps): React.ReactElement | null => {
  const prefersReducedMotion = useReducedMotion();
  const images = attachments.filter((attachment) =>
    attachment.contentType.startsWith("image/"),
  );
  if (images.length === 0) return null;
  const count = images.length;

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl ${
        count === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-0.5"
      }`}
    >
      {images.map((image, index) => (
        <motion.div
          key={image.id}
          className={`overflow-hidden bg-zinc-800 ${
            count === 1
              ? "aspect-video"
              : count === 3 && index === 0
                ? "row-span-2"
                : "aspect-square"
          }`}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.008 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenImage(index);
            }}
            className="block h-full w-full cursor-zoom-in"
            aria-label={`첨부 이미지 ${index + 1} 보기`}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <motion.img
              src={mediaUrl(image.objectKey)}
              alt={`첨부 이미지 ${index + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              transition={{ duration: 0.28 }}
            />
          </motion.button>
        </motion.div>
      ))}
    </div>
  );
};

const Post = ({
  post,
  variant = "list",
  isFocused = false,
  isAuthenticated = false,
}: PostProps): React.ReactElement => {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const [isImageModalVisible, setIsImageModalVisible] = useState<boolean>(false);

  const images = useMemo(
    () =>
      (post.attachments ?? []).filter((attachment) =>
        attachment.contentType.startsWith("image/"),
      ),
    [post.attachments],
  );
  const hasMultipleImages = images.length > 1;
  const handleOpenImage = useCallback((index: number): void => {
    setSelectedImageIndex(index);
    setIsImageModalVisible(true);
  }, []);
  const handleCloseImageModal = useCallback((): void => {
    setIsImageModalVisible(false);
  }, []);
  const handleOpenNextImage = useCallback((): void => {
    if (!hasMultipleImages) return;
    setSelectedImageIndex((current) => {
      if (current === null) return current;
      return (current + 1) % images.length;
    });
  }, [hasMultipleImages, images.length]);
  const handleOpenPreviousImage = useCallback((): void => {
    if (!hasMultipleImages) return;
    setSelectedImageIndex((current) => {
      if (current === null) return current;
      return (current - 1 + images.length) % images.length;
    });
  }, [hasMultipleImages, images.length]);

  useEffect(() => {
    if (!isImageModalVisible || selectedImageIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        handleCloseImageModal();
        return;
      }
      if (!hasMultipleImages) return;
      if (event.key === "ArrowRight") {
        handleOpenNextImage();
      }
      if (event.key === "ArrowLeft") {
        handleOpenPreviousImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isImageModalVisible,
    selectedImageIndex,
    images.length,
    hasMultipleImages,
    handleCloseImageModal,
    handleOpenNextImage,
    handleOpenPreviousImage,
  ]);
  useEffect(() => {
    if (selectedImageIndex === null || isImageModalVisible) return;
    const closeDelayMs = prefersReducedMotion ? 0 : 180;
    const timeoutId = window.setTimeout(() => {
      setSelectedImageIndex(null);
    }, closeDelayMs);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedImageIndex, isImageModalVisible, prefersReducedMotion]);

  const selectedImage =
    selectedImageIndex === null ? null : images[selectedImageIndex] ?? null;
  const imageModalContent =
    selectedImage === null ? null : (
      <motion.div
        role={isImageModalVisible ? "dialog" : undefined}
        aria-modal={isImageModalVisible ? "true" : undefined}
        aria-hidden={!isImageModalVisible}
        aria-label="사진 미리보기"
        className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/85 p-4"
        onClick={handleCloseImageModal}
        initial={false}
        animate={
          prefersReducedMotion
            ? undefined
            : { opacity: isImageModalVisible ? 1 : 0 }
        }
        transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
      >
        <motion.button
          type="button"
          className="absolute right-4 top-4 rounded-full bg-black/40 px-3 py-1.5 text-sm text-zinc-100 transition-colors hover:bg-black/60"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleCloseImageModal();
          }}
          aria-label="사진 닫기"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
        >
          닫기
        </motion.button>
        {hasMultipleImages && (
          <>
            <motion.button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-2.5 py-2 text-zinc-100 transition-colors hover:bg-black/65"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenPreviousImage();
              }}
              aria-label="이전 사진"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
            >
              ←
            </motion.button>
            <motion.button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-2.5 py-2 text-zinc-100 transition-colors hover:bg-black/65"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenNextImage();
              }}
              aria-label="다음 사진"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
            >
              →
            </motion.button>
          </>
        )}
        <motion.div
          className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1.5 text-xs text-zinc-100"
          animate={prefersReducedMotion ? undefined : { scale: [1, 1.04, 1] }}
          transition={{ duration: 0.24 }}
        >
          {selectedImageIndex + 1} / {images.length}
        </motion.div>
        <motion.img
          key={selectedImage.id}
          src={mediaUrl(selectedImage.objectKey)}
          alt={`첨부 이미지 ${selectedImageIndex + 1}`}
          className="max-h-[90vh] max-w-[90vw] object-contain"
          style={{ transformOrigin: "center center" }}
          initial={false}
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  opacity: isImageModalVisible ? 1 : 0,
                  scale: isImageModalVisible ? 1 : 0.98,
                }
          }
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      </motion.div>
    );
  const imageModal =
    imageModalContent === null || typeof document === "undefined"
      ? null
      : createPortal(imageModalContent, document.body);
  const handleListItemMouseMove = (
    event: ReactMouseEvent<HTMLElement>,
  ): void => {
    const spotlightContainer = event.currentTarget.closest(
      ".glass-spotlight",
    );
    const targetElement =
      spotlightContainer instanceof HTMLElement
        ? spotlightContainer
        : event.currentTarget;
    const targetBounds = targetElement.getBoundingClientRect();
    const pointerX = event.clientX - targetBounds.left;
    const pointerY = event.clientY - targetBounds.top;

    targetElement.style.setProperty("--hover-x", `${pointerX}px`);
    targetElement.style.setProperty("--hover-y", `${pointerY}px`);
  };

  if (variant === "detail") {
    return (
      <>
        <div onMouseMove={handleListItemMouseMove}>
          <div className="mb-3 flex items-center gap-3">
            <Link href={`/${post.author.id}`} className="shrink-0">
              <Avatar
                avatarObjectKey={post.author.avatarObjectKey}
                alt={post.author.username}
                className="h-10 w-10 rounded-full object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100">
                {post.author.username}
              </p>
              <div className="flex items-center gap-1.5">
                <time
                  dateTime={new Date(post.createdAt).toISOString()}
                  className="text-xs text-zinc-400"
                  suppressHydrationWarning
                >
                  {formatRelativeTime(post.createdAt)}
                </time>
                {post.updatedAt !== undefined &&
                  post.updatedAt !== post.createdAt && (
                    <span className="text-xs text-zinc-400">· 수정됨</span>
                  )}
              </div>
              {post.layer !== null && (
                <p className="text-xs text-postech-600 text-postech-400">
                  {post.layer.name}
                </p>
              )}
            </div>
          </div>
          <PostContent content={post.content} className="text-[15px]" />
          {post.attachments !== undefined && post.attachments.length > 0 && (
            <PhotoGrid
              attachments={post.attachments}
              onOpenImage={handleOpenImage}
            />
          )}
          <PostActions
            postId={post.id}
            replyCount={post.replyCount}
            heartCount={post.heartCount}
            isHearted={post.isHearted}
            isAuthenticated={isAuthenticated}
          />
        </div>
        {imageModal}
      </>
    );
  }

  const isRestricted =
    variant === "list" && post.visibility === "members" && !isAuthenticated;
  const avatarSize = variant === "reply" ? "h-8 w-8" : "h-9 w-9";
  const detailLabel = `${post.author.username}님의 게시글 상세 보기`;

  const navigateToDetail = (): void => {
    router.push(`/posts/${post.id}`);
  };

  const shouldIgnorePostNavigation = (
    target: EventTarget | null,
  ): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return target.closest(INTERACTIVE_ELEMENT_SELECTOR) !== null;
  };

  const body = (
    <div className="flex gap-3">
      {isRestricted ? (
        <div className="shrink-0">
          <Avatar
            avatarObjectKey={post.author.avatarObjectKey}
            alt={post.author.username}
            className={`${avatarSize} rounded-full object-cover`}
          />
        </div>
      ) : (
        <Link href={`/${post.author.id}`} className="relative z-10 shrink-0">
          <Avatar
            avatarObjectKey={post.author.avatarObjectKey}
            alt={post.author.username}
            className={`${avatarSize} rounded-full object-cover`}
          />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-semibold leading-tight text-zinc-50">
            {post.author.username}
          </span>
          <span className="text-xs text-zinc-400">·</span>
          <time
            dateTime={new Date(post.createdAt).toISOString()}
            className="text-xs text-zinc-400"
            suppressHydrationWarning
          >
            {formatRelativeTime(post.createdAt)}
          </time>
          {post.layer !== null && variant === "list" && (
            <span className="rounded-full bg-black/6 px-1.5 py-0.5 text-xs text-zinc-500 bg-white/10 text-zinc-400">
              {post.layer.name}
            </span>
          )}
        </div>

        <PostContent
          content={post.content}
          isRestricted={isRestricted}
          className={`mt-0.5 whitespace-pre-wrap text-sm [&_a]:relative [&_a]:z-10 [&_a]:break-all [&_p+p]:mt-1 ${
            variant === "reply"
              ? "leading-5 text-zinc-200"
              : "leading-snug text-zinc-100"
          }`}
        />

        {!isRestricted &&
          post.attachments !== undefined &&
          post.attachments.length > 0 && (
            <PhotoGrid
              attachments={post.attachments}
              onOpenImage={handleOpenImage}
            />
          )}

        <PostActions
          postId={post.id}
          replyCount={post.replyCount}
          heartCount={post.heartCount}
          isHearted={post.isHearted}
          isAuthenticated={isAuthenticated}
          disable={isRestricted}
          className="relative z-10"
        />
      </div>
    </div>
  );

  const postBody =
    variant === "list" ? (
      <article
        className={`post-hover-glow post-list-item relative px-4 py-3 ${
          isFocused && !isRestricted ? "post-list-item-focused" : ""
        } ${
          isRestricted
            ? "cursor-not-allowed opacity-60 pointer-events-none select-none"
            : "cursor-pointer"
        }`}
        role={isRestricted ? undefined : "link"}
        aria-label={isRestricted ? undefined : detailLabel}
        tabIndex={isRestricted ? undefined : 0}
        onClick={
          isRestricted
            ? undefined
            : (event): void => {
                if (shouldIgnorePostNavigation(event.target)) return;
                navigateToDetail();
              }
        }
        onKeyDown={
          isRestricted
            ? undefined
            : (event): void => {
                if (shouldIgnorePostNavigation(event.target)) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                navigateToDetail();
              }
        }
        onMouseMove={isRestricted ? undefined : handleListItemMouseMove}
      >
        {body}
      </article>
    ) : (
      <article
        className="relative block cursor-pointer"
        role="link"
        aria-label={detailLabel}
        tabIndex={0}
        onClick={(event): void => {
          if (shouldIgnorePostNavigation(event.target)) return;
          navigateToDetail();
        }}
        onKeyDown={(event): void => {
          if (shouldIgnorePostNavigation(event.target)) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          navigateToDetail();
        }}
      >
        {body}
      </article>
    );

  return (
    <>
      {postBody}
      {imageModal}
    </>
  );
};

export default Post;
