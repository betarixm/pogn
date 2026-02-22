import { describe, test, expect, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import {
  PostMeta,
  PostBody,
  AttachmentList,
  HeartCount,
} from "../../../app/components/post-viewer";
import { ReplyList } from "../../../app/components/reply-list";
import { createUserId, createPostId, createAttachmentId } from "../../../database/types";

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock(() => {}) }),
}));

mock.module("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

mock.module("../../../app/posts/actions", () => ({
  submitHeart: mock(async () => {}),
}));

const baseAuthor = {
  id: createUserId("u1"),
  username: "alice",
};

const baseTime = 1_700_000_000_000;

describe("PostMeta", () => {
  test("renders author username", () => {
    render(
      <PostMeta author={baseAuthor} createdAt={baseTime} updatedAt={baseTime} />,
    );

    expect(screen.getByText("alice")).toBeTruthy();
  });

  test("does not show 수정됨 when updatedAt equals createdAt", () => {
    render(
      <PostMeta author={baseAuthor} createdAt={baseTime} updatedAt={baseTime} />,
    );

    expect(screen.queryByText(/수정됨/)).toBeNull();
  });

  test("shows 수정됨 when updatedAt differs from createdAt", () => {
    render(
      <PostMeta
        author={baseAuthor}
        createdAt={baseTime}
        updatedAt={baseTime + 60_000}
      />,
    );

    expect(screen.getByText(/수정됨/)).toBeTruthy();
  });

  test("forwards className to div element", () => {
    const { container } = render(
      <PostMeta
        author={baseAuthor}
        createdAt={baseTime}
        updatedAt={baseTime}
        className="custom-class"
      />,
    );

    expect(container.querySelector("div")?.className).toContain("custom-class");
  });
});

describe("PostBody", () => {
  test("renders content text", () => {
    render(<PostBody content="오늘 날씨가 좋네요." />);
    expect(screen.getByText("오늘 날씨가 좋네요.")).toBeTruthy();
  });

  test("forwards className to section element", () => {
    const { container } = render(
      <PostBody content="내용" className="extra" />,
    );
    expect(container.querySelector("section")?.className).toContain("extra");
  });
});

describe("AttachmentList", () => {
  const attachments = [
    {
      id: createAttachmentId("att-1"),
      objectKey: "attachments/post-1/att-1/photo.png",
      contentType: "image/png",
      byteSize: 2048,
      displayOrder: 1,
    },
    {
      id: createAttachmentId("att-2"),
      objectKey: "attachments/post-1/att-2/doc.pdf",
      contentType: "application/pdf",
      byteSize: 1_048_576,
      displayOrder: 2,
    },
  ];

  test("shows attachment count in heading", () => {
    render(<AttachmentList attachments={attachments} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "첨부파일 2개",
    );
  });

  test("shows filename extracted from objectKey", () => {
    render(<AttachmentList attachments={attachments} />);
    expect(screen.getByText("photo.png")).toBeTruthy();
    expect(screen.getByText("doc.pdf")).toBeTruthy();
  });

  test("shows formatted file size", () => {
    render(<AttachmentList attachments={attachments} />);
    expect(screen.getByText(/2\.0 KB/)).toBeTruthy();
    expect(screen.getByText(/1\.0 MB/)).toBeTruthy();
  });
});

describe("HeartCount", () => {
  test("renders count", () => {
    render(<HeartCount count={42} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  test("renders zero count", () => {
    render(<HeartCount count={0} />);
    expect(screen.getByText("0")).toBeTruthy();
  });
});

describe("ReplyList", () => {
  test("shows empty state when no replies", () => {
    render(<ReplyList replies={[]} />);
    expect(screen.getByText("아직 답글이 없습니다.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "답글 0개",
    );
  });

  test("shows reply count in heading", () => {
    const replies = [
      {
        id: createPostId("reply-1"),
        author: baseAuthor,
        content: "좋은 글이네요",
        heartCount: 0,
        createdAt: baseTime,
      },
    ];
    render(<ReplyList replies={replies} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "답글 1개",
    );
  });

  test("renders each reply's content and author", () => {
    const replies = [
      {
        id: createPostId("reply-1"),
        author: { id: createUserId("u1"), username: "bob" },
        content: "첫 번째 답글",
        heartCount: 0,
        createdAt: baseTime,
      },
      {
        id: createPostId("reply-2"),
        author: { id: createUserId("u2"), username: "carol" },
        content: "두 번째 답글",
        heartCount: 0,
        createdAt: baseTime + 1000,
      },
    ];
    render(<ReplyList replies={replies} />);

    expect(screen.getByText("bob")).toBeTruthy();
    expect(screen.getByText("첫 번째 답글")).toBeTruthy();
    expect(screen.getByText("carol")).toBeTruthy();
    expect(screen.getByText("두 번째 답글")).toBeTruthy();
  });

  test("does not render list when replies is empty", () => {
    const { container } = render(<ReplyList replies={[]} />);
    expect(container.querySelector("ul")).toBeNull();
  });

  test("renders reply's time element with correct datetime attribute", () => {
    const replies = [
      {
        id: createPostId("reply-1"),
        author: baseAuthor,
        content: "답글",
        heartCount: 0,
        createdAt: baseTime,
      },
    ];
    const { container } = render(<ReplyList replies={replies} />);
    const timeEl = container.querySelector("time");
    expect(timeEl?.getAttribute("dateTime")).toBe(
      new Date(baseTime).toISOString(),
    );
  });
});
