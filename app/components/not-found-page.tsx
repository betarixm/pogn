import Link from "next/link";

type NotFoundPageProps = {
  title: string;
  description?: string;
  homePath?: string;
  homeLabel?: string;
};

const NotFoundPage = ({
  title,
  description,
  homePath = "/",
  homeLabel = "홈으로 돌아가기",
}: NotFoundPageProps): React.ReactElement => (
  <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
    <div className="max-w-sm text-center">
      <p className="mb-2 text-sm font-medium tracking-wide text-zinc-500">404</p>
      <h1 className="mb-3 text-xl font-semibold text-zinc-100">{title}</h1>
      {description !== undefined && (
        <p className="mb-6 text-sm leading-6 text-zinc-400">{description}</p>
      )}
      <Link
        href={homePath}
        className="text-sm text-zinc-300 underline underline-offset-4 transition-colors hover:text-zinc-100"
      >
        {homeLabel}
      </Link>
    </div>
  </main>
);

export default NotFoundPage;
