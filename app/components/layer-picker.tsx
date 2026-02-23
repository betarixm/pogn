"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
 "bg-black/5 text-zinc-500 hover:bg-black/10 bg-white/10 text-zinc-400 hover:bg-white/15";
const chipActive = "bg-postech-600 text-white";

const LayerPicker = ({
 layers,
 value,
 onChange,
 disabled = false,
}: LayerPickerProps): React.ReactElement => {
 const prefersReducedMotion = useReducedMotion();
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
 <motion.button
 key={layer.id}
 type="button"
 disabled={disabled}
 title={layer.description}
 onClick={() => handleSelectExisting(layer)}
 whileHover={
 prefersReducedMotion
 ? undefined
 : { y: -1.5, scale: value?.type === "existing" && value.id === layer.id ? 1.01 : 1.04 }
 }
 whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className={`${chipBase} ${
 value?.type === "existing" && value.id === layer.id
 ? chipActive
 : chipInactive
 }`}
 >
 {layer.name}
 </motion.button>
 ))}

 <AnimatePresence mode="wait" initial={false}>
 {isEnteringNew ? (
 <motion.input
 key="new-layer-input"
 initial={prefersReducedMotion ? false : { opacity: 0, width: 0, scale: 0.95 }}
 animate={prefersReducedMotion ? undefined : { opacity: 1, width: "7rem", scale: 1 }}
 exit={prefersReducedMotion ? undefined : { opacity: 0, width: 0, scale: 0.95 }}
 transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
 autoFocus
 value={newLayerName}
 onChange={(event) => setNewLayerName(event.target.value)}
 onBlur={commitNew}
 onKeyDown={handleNewKeyDown}
 placeholder="레이어 이름"
 className="shrink-0 rounded-full bg-transparent px-2.5 py-1 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none text-zinc-100 placeholder-zinc-600"
 />
 ) : (
 <motion.button
 key="new-layer-button"
 type="button"
 disabled={disabled}
 onClick={handleOpenNew}
 whileHover={prefersReducedMotion ? undefined : { y: -1.5, scale: 1.04 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className={`${chipBase} ${
 value?.type === "new"
 ? chipActive
 : "border border-dashed border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-400"
 }`}
 >
 {value?.type === "new" ? value.name : "+ 새 레이어"}
 </motion.button>
 )}
 </AnimatePresence>
 </div>
 );
};

export default LayerPicker;
