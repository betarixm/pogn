import { beforeEach, describe, test, expect, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import Post, { type PostData } from "../../../app/components/post";
import { createPostId, createUserId } from "../../../database/types";

const pushMock = mock(() => {});

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

mock.module("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

mock.module("../../../app/actions/posts", () => ({
  submitHeart: mock(async () => {}),
}));

const basePost: PostData = {
  id: createPostId("post-1"),
  author: {
    id: createUserId("user-1"),
    username: "alice",
    avatarObjectKey: null,
  },
  content: "본문",
  createdAt: 1_700_000_000_000,
  heartCount: 0,
  isHearted: false,
  replyCount: 2,
  layer: null,
  visibility: "public",
};

describe("Post navigation", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  test("list variant has an accessible detail link", () => {
    render(<Post post={basePost} variant="list" isAuthenticated={true} />);

    const detailTrigger = screen.getByRole("link", {
      name: "alice님의 게시글 상세 보기",
    });

    fireEvent.click(detailTrigger);
    expect(pushMock).toHaveBeenCalledWith("/posts/post-1");
  });

  test("restricted list variant does not render detail link", () => {
    const { container } = render(
      <Post
        post={{ ...basePost, visibility: "members" }}
        variant="list"
        isAuthenticated={false}
      />,
    );

    expect(
      screen.queryByRole("link", {
        name: "alice님의 게시글 상세 보기",
      }),
    ).toBeNull();

    const articleElement = container.querySelector("article");
    expect(articleElement?.className).toContain("cursor-not-allowed");
    expect(articleElement?.className).toContain("pointer-events-none");
  });

  test("reply variant has an accessible detail link", () => {
    render(<Post post={basePost} variant="reply" isAuthenticated={true} />);

    const detailTrigger = screen.getByRole("link", {
      name: "alice님의 게시글 상세 보기",
    });

    fireEvent.click(detailTrigger);
    expect(pushMock).toHaveBeenCalledWith("/posts/post-1");
  });

  test("clicking action buttons does not trigger card navigation", () => {
    render(<Post post={basePost} variant="list" isAuthenticated={true} />);

    const actionButton = screen.getByRole("button", { name: "2" });
    fireEvent.click(actionButton);

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenNthCalledWith(1, "/posts/post-1");
  });

  test("list variant supports keyboard navigation", () => {
    render(<Post post={basePost} variant="list" isAuthenticated={true} />);

    const detailTrigger = screen.getByRole("link", {
      name: "alice님의 게시글 상세 보기",
    });
    fireEvent.keyDown(detailTrigger, { key: "Enter" });

    expect(pushMock).toHaveBeenCalledWith("/posts/post-1");
  });
});
