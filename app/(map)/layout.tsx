import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPostsWithLocation, getLayers } from "@/database/queries/map";
import { getUserByEmail } from "@/database/queries/auth";
import { getServerSession } from "@/lib/auth";
import PostsMapShell from "@/app/components/posts-map-shell";

type MapLayoutProps = {
  children: React.ReactNode;
};

const MapLayout = async ({
  children,
}: MapLayoutProps): Promise<React.ReactElement> => {
  const [session, { env }] = await Promise.all([
    getServerSession(),
    getCloudflareContext({ async: true }),
  ]);

  const database = createDatabaseClient(env.DB);
  const isAuthenticated = session !== null;

  const [layers, userRow] = await Promise.all([
    getLayers(database),
    isAuthenticated
      ? getUserByEmail(database, session.user.email)
      : Promise.resolve(undefined),
  ]);

  const userId = userRow?.id ?? null;

  const posts = await getPostsWithLocation(database, userId);

  const username = isAuthenticated
    ? ((session.user as { username?: string } | undefined)?.username ?? null)
    : null;
  const avatarObjectKey = userRow?.avatarObjectKey ?? null;

  return (
    <div className="app-map-viewport bg-zinc-100 bg-zinc-950">
      <PostsMapShell
        posts={posts}
        layers={layers}
        isAuthenticated={isAuthenticated}
        username={username}
        userId={userId}
        avatarObjectKey={avatarObjectKey}
      >
        {children}
      </PostsMapShell>
    </div>
  );
};

export default MapLayout;
