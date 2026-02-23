"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ImagePlus, X, Lock, Globe } from "lucide-react";
import type { PostVisibility } from "@/database/types";
import type { Layer } from "@/database/queries/map";
import type { LayerSelection } from "@/app/posts/types";
import LayerPicker from "@/app/components/layer-picker";
import Avatar from "@/app/components/avatar";

const MAX_CONTENT_LENGTH = 280;
const MAX_PHOTOS = 4;

type PendingPhoto = {
 file: File;
 previewUrl: string;
};

type PostComposerProps = {
 layers: Layer[];
 placeholder: string;
 submitLabel: string;
 submittingLabel: string;
 rows?: number;
 avatarSize?: "sm" | "md";
 avatarObjectKey?: string | null;
 isAuthenticated: boolean;
 isSubmitting: boolean;
 isReady?: boolean;
 errorMessage: string | null;
 resetKey?: number;
 onSubmit: (
 content: string,
 layerSelection: LayerSelection | null,
 files: File[],
 visibility: PostVisibility,
 ) => void;
 children?: React.ReactNode;
};

const PostComposer = ({
 layers,
 placeholder,
 submitLabel,
 submittingLabel,
 rows = 3,
 avatarSize = "md",
 avatarObjectKey = null,
 isAuthenticated,
 isSubmitting,
 isReady = true,
 errorMessage,
 resetKey,
 onSubmit,
 children,
}: PostComposerProps): React.ReactElement => {
 const prefersReducedMotion = useReducedMotion();
 const [content, setContent] = useState("");
 const [layerSelection, setLayerSelection] = useState<LayerSelection | null>(
 null,
 );
 const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
 const [visibility, setVisibility] = useState<PostVisibility>("public");
 const isFirstRender = useRef(true);
 const fileInputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (isFirstRender.current) {
 isFirstRender.current = false;
 return;
 }
 setContent("");
 setLayerSelection(null);
 setVisibility("public");
 setPendingPhotos((prev) => {
 for (const photo of prev) URL.revokeObjectURL(photo.previewUrl);
 return [];
 });
 }, [resetKey]);

 // Revoke object URLs on unmount
 useEffect(() => {
 return () => {
 setPendingPhotos((prev) => {
 for (const photo of prev) URL.revokeObjectURL(photo.previewUrl);
 return prev;
 });
 };
 }, []);

 const contentLength = content.length;
 const isOverLimit = contentLength > MAX_CONTENT_LENGTH;

 const canSubmit =
 isAuthenticated &&
 (content.trim().length > 0 || pendingPhotos.length > 0) &&
 !isOverLimit &&
 !isSubmitting &&
 isReady;

 const handleSubmit = useCallback(() => {
 if (!canSubmit) return;
 onSubmit(
 content.trim(),
 layerSelection,
 pendingPhotos.map((p) => p.file),
 visibility,
 );
 }, [canSubmit, content, layerSelection, pendingPhotos, visibility, onSubmit]);

 const handleFileChange = useCallback(
 (event: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(event.target.files ?? []);
 if (files.length === 0) return;
 const remaining = MAX_PHOTOS - pendingPhotos.length;
 const toAdd = files.slice(0, remaining);
 const newPhotos: PendingPhoto[] = toAdd.map((file) => ({
 file,
 previewUrl: URL.createObjectURL(file),
 }));
 setPendingPhotos((prev) => [...prev, ...newPhotos]);
 event.target.value = "";
 },
 [pendingPhotos.length],
 );

 const removePhoto = useCallback((index: number) => {
 setPendingPhotos((prev) => {
 URL.revokeObjectURL(prev[index].previewUrl);
 return prev.filter((_, i) => i !== index);
 });
 }, []);

 const avatarClass = avatarSize === "sm" ? "h-8 w-8" : "h-9 w-9";

 return (
 <div className="flex gap-3">
 <div className="shrink-0">
 <Avatar
 avatarObjectKey={avatarObjectKey}
 alt=""
 className={`${avatarClass} rounded-full object-cover`}
 />
 </div>
 <div className="min-w-0 flex-1">
 <motion.textarea
 value={content}
 onChange={(event) => setContent(event.target.value)}
 placeholder={
 isAuthenticated ? placeholder : "로그인 후 이용할 수 있습니다"
 }
 rows={rows}
 disabled={!isAuthenticated || isSubmitting}
 whileFocus={
 prefersReducedMotion
 ? undefined
 : { boxShadow: "0 0 0 1px rgba(166,25,85,0.35), 0 6px 16px rgba(166,25,85,0.12)" }
 }
 transition={{ duration: 0.2 }}
 className="w-full resize-none bg-transparent py-1 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 text-zinc-100 placeholder-zinc-600"
 />

 {/* Photo previews */}
 {pendingPhotos.length > 0 && (
 <PhotoPreviewGrid photos={pendingPhotos} onRemove={removePhoto} />
 )}

 {/* Layer picker */}
 <div className="mb-1.5 mt-1">
 <LayerPicker
 layers={layers}
 value={layerSelection}
 onChange={setLayerSelection}
 disabled={!isAuthenticated || isSubmitting}
 />
 </div>

 {/* Slot for parent-specific controls (e.g. location in write mode) */}
 {children}

 <AnimatePresence initial={false}>
 {errorMessage !== null && (
 <motion.div
 initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.985 }}
 animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
 exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4, scale: 0.99 }}
 transition={{ duration: 0.2 }}
 className="mt-2 rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-700 bg-red-950/40 text-red-400"
 >
 {errorMessage}
 </motion.div>
 )}
 </AnimatePresence>

 <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
 <div className="flex min-w-0 flex-wrap items-center gap-2">
 {/* Photo picker */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 multiple
 className="hidden"
 onChange={handleFileChange}
 disabled={!isAuthenticated || isSubmitting}
 />
 <motion.button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={
 !isAuthenticated ||
 isSubmitting ||
 pendingPhotos.length >= MAX_PHOTOS
 }
 whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.04 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 text-zinc-600 hover:text-zinc-400"
 >
 <ImagePlus className="h-4 w-4" />
 {pendingPhotos.length > 0 && (
 <span className="tabular-nums">
 {pendingPhotos.length}/{MAX_PHOTOS}
 </span>
 )}
 </motion.button>

 {/* Visibility toggle */}
 <motion.button
 type="button"
 onClick={() =>
 setVisibility((v) => (v === "public" ? "members" : "public"))
 }
 disabled={!isAuthenticated || isSubmitting}
 whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.03 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className="flex items-center gap-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
 title={visibility === "members" ? "포스테키안 전용" : "전체 공개"}
 >
 {visibility === "members" ? (
 <>
 <Lock className="h-3.5 w-3.5 text-postech-600 text-postech-400" />
 <span className="text-postech-600 text-postech-400">
 포스테키안 전용
 </span>
 </>
 ) : (
 <>
 <Globe className="h-3.5 w-3.5 text-zinc-600" />
 <span className="text-zinc-600">
 전체 공개
 </span>
 </>
 )}
 </motion.button>
 </div>

 <div className="ml-auto flex items-center gap-2">
 <motion.span
 key={`${contentLength}-${isOverLimit}`}
 animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
 transition={{ duration: 0.22 }}
 className={`text-xs tabular-nums ${
 isOverLimit
 ? "text-red-500"
 : contentLength > MAX_CONTENT_LENGTH * 0.8
 ? "text-amber-500"
 : "text-zinc-600"
 }`}
 >
 {contentLength}/{MAX_CONTENT_LENGTH}
 </motion.span>
 <motion.button
 type="button"
 onClick={handleSubmit}
 disabled={!canSubmit}
 whileHover={prefersReducedMotion ? undefined : { y: -1.5, scale: 1.02 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className="w-28 shrink-0 whitespace-nowrap rounded-full bg-postech-600 px-4 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-postech-700 disabled:cursor-not-allowed disabled:opacity-40"
 >
 {isSubmitting ? submittingLabel : submitLabel}
 </motion.button>
 </div>
 </div>
 </div>
 </div>
 );
};

type PhotoPreviewGridProps = {
 photos: PendingPhoto[];
 onRemove: (index: number) => void;
};

const PhotoPreviewGrid = ({
 photos,
 onRemove,
}: PhotoPreviewGridProps): React.ReactElement => {
 const prefersReducedMotion = useReducedMotion();
 const count = photos.length;

 return (
 <div
 className={`mt-2 overflow-hidden rounded-xl ${
 count === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-0.5"
 }`}
 >
 <AnimatePresence initial={false}>
 {photos.map((photo, index) => (
 <motion.div
 key={photo.previewUrl}
 className={`relative overflow-hidden bg-zinc-800 ${
 count === 1
 ? "aspect-video"
 : count === 3 && index === 0
 ? "row-span-2"
 : "aspect-square"
 }`}
 initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
 animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
 exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.94, y: 6 }}
 transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.6 }}
 >
 <motion.img
 src={photo.previewUrl}
 alt=""
 className="h-full w-full object-cover"
 whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
 transition={{ duration: 0.24 }}
 />
 <motion.button
 type="button"
 onClick={() => onRemove(index)}
 whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
 transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.55 }}
 className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
 >
 <X className="h-3 w-3" />
 </motion.button>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 );
};

export default PostComposer;
