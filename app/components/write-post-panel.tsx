"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import type { PostVisibility } from "@/database/types";
import type { Layer } from "@/database/queries/map";
import type { LayerSelection, AttachmentRecord } from "@/app/posts/types";
import type { PickedLocation } from "@/app/components/post-map";
import { submitPost } from "@/app/actions/posts";
import { PostSubmissionError } from "@/app/posts/errors";
import PostComposer from "@/app/components/post-composer";

type WritePostPanelProps = {
  layers: Layer[];
  pickedLocation: PickedLocation | null;
  isLocationPending: boolean;
  isAuthenticated: boolean;
  avatarObjectKey: string | null;
  onRequestClose: () => void;
};

const uploadFiles = async (files: File[]): Promise<AttachmentRecord[]> => {
  if (files.length === 0) return [];
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await fetch("/api/media", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new PostSubmissionError(json.error ?? "사진 업로드에 실패했습니다.");
  }
  const json = (await response.json()) as { attachments: AttachmentRecord[] };
  return json.attachments;
};

const WritePostPanel = ({
  layers,
  pickedLocation,
  isLocationPending,
  isAuthenticated,
  avatarObjectKey,
  onRequestClose,
}: WritePostPanelProps): React.ReactElement => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (
      content: string,
      layerSelection: LayerSelection | null,
      files: File[],
      visibility: PostVisibility,
    ) => {
      if (pickedLocation === null) return;
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const attachments = await uploadFiles(files);
        const postId = await submitPost({
          content,
          latitude: pickedLocation.latitude,
          longitude: pickedLocation.longitude,
          visibility,
          layerSelection,
          attachments,
        });
        router.push(`/posts/${postId}`);
      } catch (error) {
        if (error instanceof PostSubmissionError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("오류가 발생했습니다. 다시 시도해주세요.");
        }
        setIsSubmitting(false);
      }
    },
    [pickedLocation, router],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/40 px-4 py-3 dark:border-white/6">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          새 글
        </span>
        <button
          type="button"
          onClick={onRequestClose}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          취소
        </button>
      </div>

      {/* Form body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <PostComposer
          layers={layers}
          placeholder="지금 무슨 일이 일어나고 있나요?"
          submitLabel="게시"
          submittingLabel="게시 중…"
          rows={5}
          avatarSize="md"
          avatarObjectKey={avatarObjectKey}
          isAuthenticated={isAuthenticated}
          isSubmitting={isSubmitting}
          isReady={pickedLocation !== null}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
        >
          {/* Location row */}
          <div className="mb-1 mt-0.5 flex items-center gap-1.5 text-xs">
            <MapPin
              className={`h-3 w-3 shrink-0 ${"text-zinc-300 dark:text-zinc-700"}`}
            />
            <div className="min-w-0 flex-1 truncate text-zinc-400 dark:text-zinc-600">
              {isLocationPending ? (
                <span>위치 가져오는 중…</span>
              ) : pickedLocation !== null ? (
                <span>
                  {pickedLocation.latitude.toFixed(5)},{" "}
                  {pickedLocation.longitude.toFixed(5)}
                  <span className="ml-1 opacity-60">· 지도를 탭해 변경</span>
                </span>
              ) : (
                <span className="text-amber-500 dark:text-amber-400">
                  지도를 탭해 위치를 선택하세요
                </span>
              )}
            </div>
          </div>
        </PostComposer>
      </div>
    </div>
  );
};

export default WritePostPanel;
