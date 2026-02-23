import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolveAuthBaseUrl } from "../../lib/auth-base-url";

const originalEnvironment = { ...process.env };
const originalWindow = (globalThis as { window?: Window }).window;

const restoreEnvironment = (): void => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, originalEnvironment);
};

const restoreWindow = (): void => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    return;
  }

  Reflect.deleteProperty(globalThis as Record<string, unknown>, "window");
};

describe("resolveAuthBaseUrl", () => {
  beforeEach(() => {
    restoreEnvironment();
    restoreWindow();
  });

  afterEach(() => {
    restoreEnvironment();
    restoreWindow();
  });

  test("uses localhost in development on server runtime", () => {
    Reflect.deleteProperty(globalThis as Record<string, unknown>, "window");

    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SITE_URL = "https://pogn.today";
    process.env.PORT = "3000";

    expect(resolveAuthBaseUrl()).toBe("http://localhost:3000");
  });

  test("prefers BETTER_AUTH_URL when configured", () => {
    process.env.NODE_ENV = "development";
    process.env.BETTER_AUTH_URL = "https://auth.example.com";
    process.env.PORT = "3000";

    expect(resolveAuthBaseUrl()).toBe("https://auth.example.com");
  });
});
