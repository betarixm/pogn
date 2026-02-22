import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPostById, getPostThread } from "@/database/queries/posts";
import { getLayers } from "@/database/queries/map";
import { getUserById } from "@/database/queries/auth";
import { createPostId, createUserId } from "@/database/types";
import { getServerSession } from "@/lib/auth";
import { PostCard } from "@/app/components/post-card";
import { PostTimestamp } from "@/app/components/post-timestamp";
import { ThreadList } from "@/app/components/thread-list";
import ReplyForm from "@/app/components/reply-form";

type PostPageProps = {
  params: Promise<{ postId: string }>;
};

const truncate = (text: string, maxLength: number): string =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;

export const generateMetadata = async ({
  params,
}: PostPageProps): Promise<Metadata> => {
  const { postId } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const post = await getPostById(database, createPostId(postId), null);

  if (post === null) {
    return {};
  }

  const title = truncate(post.content, 60);
  const description = truncate(post.content, 120);
  const publishedTime = new Date(post.createdAt).toISOString();
  const modifiedTime = new Date(post.updatedAt).toISOString();

  return {
    title,
    description,
    alternates: {
      canonical: `/posts/${postId}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      modifiedTime,
      authors: [post.author.username],
      tags: post.layer !== null ? [post.layer.name] : [],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
};

const PostPage = async ({ params }: PostPageProps): Promise<React.ReactElement> => {
  const { postId } = await params;
  const [session, { env }] = await Promise.all([
    getServerSession(),
    getCloudflareContext({ async: true }),
  ]);
  const database = createDatabaseClient(env.DB);
  const isAuthenticated = session !== null;
  const [post, thread, layers, userRow] = await Promise.all([
    getPostById(database, createPostId(postId), session !== null ? createUserId(session.user.id) : null),
    getPostThread(database, createPostId(postId), isAuthenticated),
    getLayers(database),
    session !== null
      ? getUserById(database, createUserId(session.user.id))
      : Promise.resolve(undefined),
  ]);
  const avatarObjectKey = userRow?.avatarObjectKey ?? null;

  if (post === null) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    text: post.content,
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: post.author.username,
    },
    ...(post.layer !== null && { articleSection: post.layer.name }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Ancestor context */}
      {thread.ancestors.length > 0 && (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {thread.ancestors.map((ancestor) => (
            <li key={ancestor.id}>
              <PostCard
                variant="list"
                isAuthenticated={isAuthenticated}
                post={{
                  id: ancestor.id,
                  author: ancestor.author,
                  content: ancestor.content,
                  createdAt: ancestor.createdAt,
                  heartCount: 0,
                  isHearted: false,
                  replyCount: 0,
                  layer: null,
                  visibility: "public",
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {/* Post content */}
      <article className="px-4 pb-3 pt-4">
        <PostCard
          variant="detail"
          isAuthenticated={isAuthenticated}
          post={{
            id: post.id,
            author: post.author,
            content: post.content,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            heartCount: post.heartCount,
            isHearted: post.isHearted,
            replyCount: thread.descendants.filter((d) => d.parentId === post.id).length,
            layer: post.layer,
            visibility: post.visibility,
            attachments: post.attachments,
          }}
        />
        <PostTimestamp
          createdAt={post.createdAt}
          updatedAt={post.updatedAt}
          className="mt-3"
        />
      </article>
      {/* Reply composer */}
      <div className="border-t border-zinc-200/60 px-4 py-3 dark:border-white/10">
        <ReplyForm
          postId={post.id}
          layers={layers}
          isAuthenticated={isAuthenticated}
          avatarObjectKey={avatarObjectKey}
        />
      </div>
      {/* Full thread (all descendants, DFS flattened) */}
      <div className="border-t border-zinc-200/60 px-4 py-4 dark:border-white/10">
        <ThreadList descendants={thread.descendants} isAuthenticated={isAuthenticated} />
      </div>
    </>
  );
};

export default PostPage;
