import type { LayerId } from "@/database/types";

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type LayerSelection =
  | { readonly type: "existing"; readonly id: LayerId; readonly name: string }
  | { readonly type: "new"; readonly name: string };

export type AttachmentRecord = {
  readonly objectKey: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly displayOrder: number;
};
