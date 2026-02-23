import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { createDatabaseClient } from "@/database/client";
import type { AppDatabase } from "@/database/client";
import * as schema from "@/database/schema";
import { createUserId, generateUserId } from "@/database/types";
import { resolveAuthBaseUrl } from "@/lib/auth-base-url";

const createAuth = (database: AppDatabase) =>
  betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: resolveAuthBaseUrl(),
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema: {
        user: schema.authUser,
        session: schema.authSession,
        account: schema.authAccount,
        verification: schema.authVerification,
      },
    }),
    user: {
      additionalFields: {
        username: {
          type: "string",
          required: false,
          returned: true,
        },
      },
    },
    socialProviders: {
      microsoft: {
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        tenantId: process.env.MICROSOFT_TENANT_ID!,
      },
    },
    advanced: {
      database: {
        generateId: ({ model }) => {
          if (model === "user") {
            return generateUserId();
          }

          return crypto.randomUUID();
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              // user.id is not yet assigned at this point in better-auth's
              // lifecycle, so derive the default username from a fresh UUID.
              username: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
            },
          }),
          after: async (user) => {
            await database.insert(schema.users).values({
              id: createUserId(user.id),
              username: (user as { username?: string }).username ?? user.id.replace(/-/g, "").slice(0, 8),
              email: user.email,
              role: "member",
              createdAt: Date.now(),
            });
          },
        },
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;

export const getServerSession = async (): Promise<
  Awaited<ReturnType<Auth["api"]["getSession"]>>
> => {
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  const auth = createAuth(database);
  return auth.api.getSession({ headers: await headers() });
};

export const createAuthHandler = async (): Promise<Auth["handler"]> => {
  const { env } = await getCloudflareContext({ async: true });
  const database = createDatabaseClient(env.DB);
  return createAuth(database).handler;
};
