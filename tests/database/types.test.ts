import { describe, expect, test } from "bun:test";
import { generateLayerId, generateUserId } from "../../database/types";

describe("generateUserId", () => {
  test("returns a compact numeric identifier", () => {
    const userId = generateUserId();

    expect(userId).toMatch(/^\d+$/);
    expect(userId.length).toBeLessThan(36);
  });

  test("generates unique values across consecutive calls", () => {
    const userIdA = generateUserId();
    const userIdB = generateUserId();

    expect(userIdA).not.toBe(userIdB);
  });
});

describe("generateLayerId", () => {
  test("returns a compact numeric identifier", () => {
    const layerId = generateLayerId();

    expect(layerId).toMatch(/^\d+$/);
    expect(layerId.length).toBeLessThan(36);
  });

  test("generates unique values across consecutive calls", () => {
    const layerIdA = generateLayerId();
    const layerIdB = generateLayerId();

    expect(layerIdA).not.toBe(layerIdB);
  });
});
