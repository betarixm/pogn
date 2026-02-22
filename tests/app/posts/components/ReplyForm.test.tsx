import { describe, test, expect, mock, afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import ReplyForm from "../../../../app/posts/components/ReplyForm";
import { createPostId } from "../../../../database/types";

mock.module("next/navigation", () => ({
  useRouter: () => ({ refresh: mock(() => {}) }),
}));

mock.module("../../../../app/posts/actions", () => ({
  submitReply: mock(async () => {
    throw new Error("not implemented");
  }),
}));

afterEach(() => {
  cleanup();
});

const postId = createPostId("post-1");

describe("ReplyForm", () => {
  test("renders textarea and submit button", () => {
    render(<ReplyForm postId={postId} isAuthenticated={true} />);
    expect(screen.getByPlaceholderText("답글을 입력하세요")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "답글 달기" }),
    ).toBeTruthy();
  });

  test("shows auth notice when not authenticated", () => {
    render(<ReplyForm postId={postId} isAuthenticated={false} />);
    expect(screen.getByText("로그인이 필요합니다.")).toBeTruthy();
  });

  test("hides auth notice when authenticated", () => {
    render(<ReplyForm postId={postId} isAuthenticated={true} />);
    expect(screen.queryByText("로그인이 필요합니다.")).toBeNull();
  });

  test("disables textarea and button when not authenticated", () => {
    render(<ReplyForm postId={postId} isAuthenticated={false} />);
    const textarea = screen.getByPlaceholderText(
      "답글을 입력하세요",
    ) as HTMLTextAreaElement;
    const button = screen.getByRole("button", {
      name: "답글 달기",
    }) as HTMLButtonElement;
    expect(textarea.disabled).toBe(true);
    expect(button.disabled).toBe(true);
  });

  test("disables submit button when textarea is empty", () => {
    render(<ReplyForm postId={postId} isAuthenticated={true} />);
    const button = screen.getByRole("button", {
      name: "답글 달기",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
