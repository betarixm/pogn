import { describe, test, expect, mock } from "bun:test";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import Post from "../../../app/components/post";
import {
  createAttachmentId,
  createPostId,
  createUserId,
} from "../../../database/types";

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
  }),
}));

mock.module("../../../app/components/post-actions", () => ({
  default: () => <div data-testid="post-actions" />,
}));

const basePost = {
  id: createPostId("post-1"),
  author: {
    id: createUserId("user-1"),
    username: "alice",
    avatarObjectKey: null,
  },
  content: "사진 테스트",
  createdAt: 1_700_000_000_000,
  heartCount: 0,
  isHearted: false,
  replyCount: 0,
  layer: null,
  visibility: "public" as const,
};

describe("Post image modal", () => {
  test("opens modal when image is clicked and closes with Escape", async () => {
    render(
      <Post
        post={{
          ...basePost,
          attachments: [
            {
              id: createAttachmentId("att-1"),
              objectKey: "attachments/post-1/att-1/photo-1.png",
              contentType: "image/png",
            },
          ],
        }}
        variant="list"
        isAuthenticated
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "첨부 이미지 1 보기" }));
    const dialog = screen.getByRole("dialog", { name: "사진 미리보기" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByAltText("첨부 이미지 1")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "사진 미리보기" })).toBeNull();
    });
  });

  test("moves to next image with ArrowRight key when modal is open", () => {
    render(
      <Post
        post={{
          ...basePost,
          attachments: [
            {
              id: createAttachmentId("att-1"),
              objectKey: "attachments/post-1/att-1/photo-1.png",
              contentType: "image/png",
            },
            {
              id: createAttachmentId("att-2"),
              objectKey: "attachments/post-1/att-2/photo-2.png",
              contentType: "image/png",
            },
          ],
        }}
        variant="detail"
        isAuthenticated
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "첨부 이미지 1 보기" }));
    let dialog = screen.getByRole("dialog", { name: "사진 미리보기" });
    expect(within(dialog).getByAltText("첨부 이미지 1")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    dialog = screen.getByRole("dialog", { name: "사진 미리보기" });
    expect(within(dialog).getByAltText("첨부 이미지 2")).toBeTruthy();
  });
});
