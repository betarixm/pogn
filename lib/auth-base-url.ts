const LOCAL_DEVELOPMENT_URL = "http://localhost:3000";
const resolveExplicitAuthUrl = (): string | undefined =>
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
  process.env.PUBLIC_BETTER_AUTH_URL;

export const resolveAuthBaseUrl = (): string => {
  const browserOrigin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const explicitAuthUrl = resolveExplicitAuthUrl();

  if (explicitAuthUrl) {
    return explicitAuthUrl;
  }

  if (process.env.NODE_ENV === "development") {
    if (browserOrigin) {
      return browserOrigin;
    }

    const port = process.env.PORT ?? "3000";
    return `http://localhost:${port}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? browserOrigin ?? LOCAL_DEVELOPMENT_URL;
};
