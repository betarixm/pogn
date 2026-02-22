"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PostId } from "@/database/types";
import type { Layer } from "@/database/queries/map";
import type { LayerSelection, AttachmentRecord } from "@/app/posts/types";
import { submitReply } from "@/app/actions/posts";
import { ReplySubmissionError } from "@/app/posts/errors";
import PostComposer from "@/app/components/post-composer";

type ReplyFormProps = {
  postId: PostId;
  layers: Layer[];
  isAuthenticated: boolean;
  avatarObjectKey?: string | null;
  onSubmitSuccess?: () => void;
};

const uploadFiles = async (files: File[]): Promise<AttachmentRecord[]> => {
  if (files.length === 0) return [];
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await fetch("/api/media", { method: "POST", body: formData });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ReplySubmissionError(json.error ?? "사진 업로드에 실패했습니다.");
  }
  const json = (await response.json()) as { attachments: AttachmentRecord[] };
  return json.attachments;
};

const ReplyForm = ({
  postId,
  layers,
  isAuthenticated,
  avatarObjectKey,
  onSubmitSuccess,
}: ReplyFormProps): React.ReactElement => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleSubmit = useCallback(
    async (
      content: string,
      layerSelection: LayerSelection | null,
      files: File[],
    ) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const attachments = await uploadFiles(files);
        await submitReply({ postId, content, layerSelection, attachments });
        setResetKey((k) => k + 1);
        onSubmitSuccess?.();
        router.refresh();
      } catch (error) {
        if (error instanceof ReplySubmissionError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("오류가 발생했습니다. 다시 시도해주세요.");
        }
        setIsSubmitting(false);
      }
    },
    [postId, router, onSubmitSuccess],
  );

  return (
    <PostComposer
      layers={layers}
      placeholder="답글을 입력하세요"
      submitLabel="답글"
      submittingLabel="게시 중…"
      rows={2}
      avatarSize="sm"
      avatarObjectKey={avatarObjectKey}
      isAuthenticated={isAuthenticated}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      resetKey={resetKey}
      onSubmit={handleSubmit}
    />
  );
};

export default ReplyForm;
