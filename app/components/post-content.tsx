import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type PostContentProps = React.HTMLAttributes<HTMLElement> & {
  content: string;
  isRestricted?: boolean;
};

const PostContent = ({
  content,
  isRestricted = false,
  className,
  ...props
}: PostContentProps): React.ReactElement => (
  <section
    className={`prose prose-zinc prose-sm prose-invert max-w-none [&_p]:my-0 ${className ?? ""}`.trim()}
    {...props}
  >
    {isRestricted ? (
      <p>포스테키안만 볼 수 있는 글입니다. 로그인 후 확인하세요.</p>
    ) : (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    )}
  </section>
);

export default PostContent;
