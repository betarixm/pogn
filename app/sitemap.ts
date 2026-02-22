import type { MetadataRoute } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPublicPostsForSitemap } from "@/database/queries/sitemap";

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const posts = await getPublicPostsForSitemap(database);

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `/posts/${post.id}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: "/posts",
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...postEntries,
  ];
};

export default sitemap;
