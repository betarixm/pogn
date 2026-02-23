import { describe, test, expect, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import RootNotFound from "../../app/not-found";
import MapNotFound from "../../app/(map)/not-found";
import PostNotFound from "../../app/(map)/posts/[postId]/not-found";

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

describe("not found pages", () => {
  test("renders root not found with dark background classes", () => {
    const { container } = render(<RootNotFound />);

    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeTruthy();
    expect(container.firstElementChild?.className).toContain("bg-zinc-950");
    expect(container.firstElementChild?.className).toContain("text-zinc-100");
    expect(container.firstElementChild?.className).not.toContain("bg-zinc-50");
  });

  test("renders map not found message", () => {
    render(<MapNotFound />);
    expect(screen.getByText("사용자를 찾을 수 없습니다")).toBeTruthy();
  });

  test("renders post not found message", () => {
    render(<PostNotFound />);
    expect(screen.getByText("포스트를 찾을 수 없습니다")).toBeTruthy();
  });
});
