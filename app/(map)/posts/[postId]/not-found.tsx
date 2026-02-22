import Link from "next/link";

const PostNotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
    <div className="text-center">
      <p className="mb-2 text-sm text-zinc-400">404</p>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        포스트를 찾을 수 없습니다
      </h1>
      <Link
        href="/"
        className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-50"
      >
        홈으로 돌아가기
      </Link>
    </div>
  </div>
);

export default PostNotFound;
