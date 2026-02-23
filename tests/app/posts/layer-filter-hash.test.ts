import { describe, expect, test } from "bun:test";
import {
  buildLayerFilterHash,
  parseActiveLayerIdsFromHash,
} from "../../../app/posts/layer-filter-hash";
import { createLayerId } from "../../../database/types";

const firstLayerId = createLayerId("layer-1");
const secondLayerId = createLayerId("layer-2");
const thirdLayerId = createLayerId("layer-3");
const allLayerIds = [firstLayerId, secondLayerId, thirdLayerId] as const;

describe("layer filter hash", () => {
  test("parses selected layers from hash", () => {
    const activeLayerIds = parseActiveLayerIdsFromHash(
      "#layers=layer-1,layer-3",
      allLayerIds,
    );

    expect(activeLayerIds).not.toBeNull();
    expect(activeLayerIds?.has(firstLayerId)).toBe(true);
    expect(activeLayerIds?.has(secondLayerId)).toBe(false);
    expect(activeLayerIds?.has(thirdLayerId)).toBe(true);
  });

  test("returns null when layers hash is missing", () => {
    const activeLayerIds = parseActiveLayerIdsFromHash("#foo=bar", allLayerIds);

    expect(activeLayerIds).toBeNull();
  });

  test("keeps empty selection when hash value is empty", () => {
    const activeLayerIds = parseActiveLayerIdsFromHash("#layers=", allLayerIds);

    expect(activeLayerIds).not.toBeNull();
    expect(activeLayerIds?.size).toBe(0);
  });

  test("ignores unknown ids from hash", () => {
    const activeLayerIds = parseActiveLayerIdsFromHash(
      "#layers=layer-2,unknown-layer",
      allLayerIds,
    );

    expect(activeLayerIds).not.toBeNull();
    expect(activeLayerIds?.size).toBe(1);
    expect(activeLayerIds?.has(secondLayerId)).toBe(true);
  });

  test("builds hash only when selection is partial", () => {
    const activeLayerIds = new Set([firstLayerId, thirdLayerId]);

    const hash = buildLayerFilterHash("", allLayerIds, activeLayerIds);

    expect(hash).toBe("#layers=layer-1%2Clayer-3");
  });

  test("removes layers key when all layers are selected", () => {
    const activeLayerIds = new Set(allLayerIds);

    const hash = buildLayerFilterHash("#foo=bar&layers=layer-1", allLayerIds, activeLayerIds);

    expect(hash).toBe("#foo=bar");
  });

  test("preserves other hash params", () => {
    const activeLayerIds = new Set([secondLayerId]);

    const hash = buildLayerFilterHash("#foo=bar", allLayerIds, activeLayerIds);

    expect(hash).toBe("#foo=bar&layers=layer-2");
  });
});
