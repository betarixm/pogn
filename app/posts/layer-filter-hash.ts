import type { LayerId } from "@/database/types";

const LAYERS_HASH_KEY = "layers";

const normalizeLayerIds = (
  layerIds: readonly LayerId[],
): { readonly ordered: LayerId[]; readonly known: Set<LayerId> } => {
  const ordered = [...layerIds];
  return {
    ordered,
    known: new Set(ordered),
  };
};

export const parseActiveLayerIdsFromHash = (
  hash: string,
  layerIds: readonly LayerId[],
): Set<LayerId> | null => {
  const { known } = normalizeLayerIds(layerIds);
  const hashContent = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(hashContent);
  const encodedLayerIds = params.get(LAYERS_HASH_KEY);

  if (encodedLayerIds === null) return null;
  if (encodedLayerIds.trim() === "") return new Set<LayerId>();

  const selectedLayerIds = encodedLayerIds
    .split(",")
    .map((value) => value.trim() as LayerId)
    .filter((value) => value.length > 0)
    .filter((value) => known.has(value));

  return new Set(selectedLayerIds);
};

export const buildLayerFilterHash = (
  currentHash: string,
  layerIds: readonly LayerId[],
  activeLayerIds: ReadonlySet<LayerId>,
): string => {
  const { ordered, known } = normalizeLayerIds(layerIds);
  const params = new URLSearchParams(
    currentHash.startsWith("#") ? currentHash.slice(1) : currentHash,
  );

  const selectedLayerIds = ordered.filter((layerId) => activeLayerIds.has(layerId));
  const isAllSelected = selectedLayerIds.length === ordered.length;

  if (isAllSelected) {
    params.delete(LAYERS_HASH_KEY);
  } else {
    const encoded = selectedLayerIds.filter((layerId) => known.has(layerId)).join(",");
    params.set(LAYERS_HASH_KEY, encoded);
  }

  const nextHash = params.toString();
  return nextHash.length > 0 ? `#${nextHash}` : "";
};
