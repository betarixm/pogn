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

  const author = {
    id: user.id,
    username: user.username,
    avatarObjectKey: user.avatarObjectKey,
  };

  const feedItems = [
    ...posts.map((p) => ({
      id: p.id,
      author,
      content: p.content,
      createdAt: p.createdAt,
      heartCount: p.heartCount,
      isHearted: false as const,
      replyCount: p.replyCount,
      layer: p.layer,
      visibility: p.visibility,
      attachments: p.attachments,
    })),
    ...replies.map((r) => ({
      id: r.id,
      rootPostId: r.rootPostId,
      author,
      content: r.content,
      createdAt: r.createdAt,
      heartCount: r.heartCount,
      isHearted: false as const,
      replyCount: 0,
      layer: null,
      visibility: r.visibility,
      attachments: r.attachments,
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="pointer-events-auto min-h-0 flex-1 overflow-hidden overflow-y-auto overscroll-contain rounded-2xl pb-[env(safe-area-inset-bottom,0px)] [scrollbar-width:none] md:pb-0">
      {/* Profile metadata */}
      <div className={GLASS}>
        <ProfilePanel
          user={user}
          isOwner={isOwner}
          postCount={posts.length}
          replyCount={replies.length}
        />
      </div>

      {/* Chronological feed */}
      <div className={`${GLASS} mt-2`}>
        {feedItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">
            아직 활동이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {feedItems.map((item) => (
              <li key={item.id}>
                <Post
                  post={item}
                  variant="list"
                  isAuthenticated={isAuthenticated}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
