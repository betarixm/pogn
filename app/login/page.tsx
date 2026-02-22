import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDatabaseClient } from "@/database/client";
import { getPostsWithLocation } from "@/database/queries/map";
import { getServerSession } from "@/lib/auth";
import LoginMap from "@/app/components/login-map";
import LoginForm from "@/app/components/login-form";

const LoginPage = async (): Promise<React.ReactElement> => {
  const session = await getServerSession();
  if (session !== null) redirect("/posts");

  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const posts = await getPostsWithLocation(database, null, 200);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background map — pointer-events disabled so it acts as a liveness backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <LoginMap posts={posts} />
      </div>
      <LoginForm />
    </div>
  );
};

export default LoginPage;
