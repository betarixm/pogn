import { createAuthClient } from "better-auth/react";
import { resolveAuthBaseUrl } from "@/lib/auth-base-url";

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
});
