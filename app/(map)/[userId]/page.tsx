import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { createUserId } from "@/database/types";
import { getUserProfileData } from "@/database/queries/profile";
import { getServerSession } from "@/lib/auth";
import Post from "@/app/components/post";
import ProfilePanel from "@/app/components/profile-panel";

type UserProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export const generateMetadata = async ({
  params,
}: UserProfilePageProps): Promise<Metadata> => {
  const { userId } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const profileData = await getUserProfileData(
    database,
    createUserId(userId),
    false,
  );

  if (profileData === null) {
    return {};
  }

  const { user, posts, replies } = profileData;
  const title = `@${user.username}`;
  const description = `게시글 ${posts.length} · 답글 ${replies.length}`;
  const canonicalPath = `/${userId}`;
  const avatarUrl = user.avatarObjectKey
    ? `/api/avatar?key=${encodeURIComponent(user.avatarObjectKey)}`
    : `/default-avatar.png`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      type: "profile",
      url: canonicalPath,
      username: user.username,
      images: [{ url: avatarUrl, alt: user.username }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [avatarUrl],
    },
  };
};

const GLASS =
  "pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-white/55 backdrop-blur-xl backdrop-saturate-200 bg-zinc-900/45";

const UserProfilePage = async ({
  params,
}: UserProfilePageProps): Promise<React.ReactElement> => {
  const { userId } = await params;

  const [session, { env }] = await Promise.all([
    getServerSession(),
    getCloudflareContext({ async: true }),
  ]);

  const isAuthenticated = session !== null;
  const isOwner = session?.user.id === userId;

  const database = createDatabaseClient(env.DB);
  const profileData = await getUserProfileData(
    database,
    createUserId(userId),
    isAuthenticated,
  );

  if (profileData === null) {
    notFound();
  }

  const { user, posts, replies } = profileData;

  return (
    <>
      {/* Panel 1: User metadata */}
      <ProfilePanel
        user={user}
        isOwner={isOwner}
        postCount={posts.length}
        replyCount={replies.length}
      />

      {/* Panel 2: Posts */}
      <div
        className={`${GLASS} ${posts.length === 0 ? "shrink-0" : "min-h-0 flex-1"}`}
      >
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="border-b border-white/8 px-4 py-2.5">
            <span className="text-xs font-medium text-zinc-500">게시글</span>
            <span className="ml-1.5 tabular-nums text-xs text-zinc-400">
              {posts.length}
            </span>
          </div>
          <ul className="divide-y divide-zinc-900">
            {posts.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-600">
                아직 게시글이 없습니다.
              </li>
            ) : (
              posts.map((post) => (
                <li key={post.id}>
                  <Post
                    post={{
                      id: post.id,
                      author: {
                        id: user.id,
                        username: user.username,
                        avatarObjectKey: user.avatarObjectKey,
                      },
                      content: post.content,
                      createdAt: post.createdAt,
                      heartCount: post.heartCount,
                      isHearted: false,
                      replyCount: post.replyCount,
                      layer: post.layer,
                      visibility: post.visibility,
                    }}
                    variant="list"
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Panel 3: Replies */}
      <div
        className={`${GLASS} ${replies.length === 0 ? "shrink-0" : "min-h-0 flex-1"}`}
      >
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="border-b border-white/8 px-4 py-2.5">
            <span className="text-xs font-medium text-zinc-500">답글</span>
            <span className="ml-1.5 tabular-nums text-xs text-zinc-400">
              {replies.length}
            </span>
          </div>
          <ul className="divide-y divide-zinc-900">
            {replies.length === 0 ? (
              <li className="py-8 text-center text-sm text-zinc-600">
                아직 답글이 없습니다.
              </li>
            ) : (
              replies.map((reply) => (
                <li key={reply.id}>
                  <Post
                    post={{
                      id: reply.id,
                      author: {
                        id: user.id,
                        username: user.username,
                        avatarObjectKey: user.avatarObjectKey,
                      },
                      content: reply.content,
                      createdAt: reply.createdAt,
                      heartCount: reply.heartCount,
                      isHearted: false,
                      replyCount: 0,
                      layer: null,
                      visibility: reply.visibility,
                    }}
                    variant="list"
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </>
  );
};

export default UserProfilePage;
