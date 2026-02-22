"use client";

import { useState, useCallback } from "react";
import type { Layer } from "@/database/queries/map";
import type { LayerSelection } from "@/app/posts/types";

type LayerPickerProps = {
  layers: Layer[];
  value: LayerSelection | null;
  onChange: (selection: LayerSelection | null) => void;
  disabled?: boolean;
};

const chipBase =
  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const chipInactive =
  "bg-black/5 text-zinc-500 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15";
const chipActive = "bg-postech-600 text-white";

const LayerPicker = ({
  layers,
  value,
  onChange,
  disabled = false,
}: LayerPickerProps): React.ReactElement => {
  const [isEnteringNew, setIsEnteringNew] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");

  const handleSelectExisting = useCallback(
    (layer: Layer) => {
      if (value?.type === "existing" && value.id === layer.id) {
        onChange(null);
      } else {
        onChange({ type: "existing", id: layer.id, name: layer.name });
      }
    },
    [value, onChange],
  );

  const commitNew = useCallback(() => {
    const trimmed = newLayerName.trim();
    if (trimmed === "") {
      setIsEnteringNew(false);
      return;
    }
    onChange({ type: "new", name: trimmed });
    setIsEnteringNew(false);
    setNewLayerName("");
  }, [newLayerName, onChange]);

  const handleNewKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        commitNew();
      } else if (event.key === "Escape") {
        setIsEnteringNew(false);
        setNewLayerName("");
      }
    },
    [commitNew],
  );

  const handleOpenNew = useCallback(() => {
    if (value?.type === "new") {
      setNewLayerName(value.name);
    }
    setIsEnteringNew(true);
  }, [value]);

  return (
    <div className="flex flex-wrap gap-1.5" style={{ scrollbarWidth: "none" }}>
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          disabled={disabled}
          title={layer.description}
          onClick={() => handleSelectExisting(layer)}
          className={`${chipBase} ${
            value?.type === "existing" && value.id === layer.id
              ? chipActive
              : chipInactive
          }`}
        >
          {layer.name}
        </button>
      ))}

      {isEnteringNew ? (
        <input
          autoFocus
          value={newLayerName}
          onChange={(event) => setNewLayerName(event.target.value)}
          onBlur={commitNew}
          onKeyDown={handleNewKeyDown}
          placeholder="레이어 이름"
          className="shrink-0 rounded-full border border-postech-400 bg-transparent px-2.5 py-1 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none dark:border-postech-500 dark:text-zinc-100 dark:placeholder-zinc-600"
          style={{ width: "7rem" }}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpenNew}
          className={`${chipBase} ${
            value?.type === "new"
              ? chipActive
              : "border border-dashed border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-400"
          }`}
        >
          {value?.type === "new" ? value.name : "+ 새 레이어"}
        </button>
      )}
    </div>
  );
};

export default LayerPicker;
