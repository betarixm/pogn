"use client";

const formatFullTimestamp = (unixMs: number): string => {
  const d = new Date(unixMs);
  const time = d.toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${time} · ${date}`;
};

export type PostTimestampProps = React.HTMLAttributes<HTMLElement> & {
  createdAt: number;
  updatedAt: number;
};

export const PostTimestamp = ({
  createdAt,
  updatedAt,
  className,
  ...props
}: PostTimestampProps): React.ReactElement => (
  <div
    className={`flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 ${className ?? ""}`.trim()}
    {...props}
  >
    <time dateTime={new Date(createdAt).toISOString()} suppressHydrationWarning>
      {formatFullTimestamp(createdAt)}
    </time>
    {updatedAt !== createdAt && <span>· 수정됨</span>}
  </div>
);
