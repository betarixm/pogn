import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPostsWithLocation, getLayers } from "@/database/queries/map";
import { getUserById } from "@/database/queries/auth";
import { createUserId } from "@/database/types";
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
  const userId = isAuthenticated ? session.user.id : null;

  const [posts, layers, userRow] = await Promise.all([
    getPostsWithLocation(
      database,
      userId !== null ? createUserId(userId) : null,
    ),
    getLayers(database),
    userId !== null
      ? getUserById(database, createUserId(userId))
      : Promise.resolve(undefined),
  ]);

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
