"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import type { MapPost, Layer } from "@/database/queries/map";
import type { LayerId, PostId } from "@/database/types";
import type { MapBounds } from "@/app/posts/types";
import type { PickedLocation, MapInsets } from "@/app/components/post-map";
import { PenLine, LogIn } from "lucide-react";
import { searchPostIds } from "@/app/actions/posts";
import PostList from "@/app/components/post-list";
import UserMenu from "@/app/components/user-menu";
import SearchBar from "@/app/components/search-bar";
import WritePostPanel from "@/app/components/write-post-panel";

const PostMap = dynamic(() => import("@/app/components/post-map"), { ssr: false });

// PANEL_BOTTOM_* matches the `animate={{ bottom }}` values in the floating container.
// FILTER_BANNER_HEIGHT ≈ PANEL_BOTTOM_FILTERED - PANEL_BOTTOM_DEFAULT (41px).
const PANEL_BOTTOM_DEFAULT = 12;
const PANEL_BOTTOM_FILTERED = 53;
const FILTER_BANNER_HEIGHT = PANEL_BOTTOM_FILTERED - PANEL_BOTTOM_DEFAULT;
// Tailwind md breakpoint (px)
const MD_BREAKPOINT = 768;
// Desktop sidebar: inset-x-3 (12px) + w-80 (320px)
const SIDEBAR_LEFT_INSET = 332;

const computeMapInsets = (isFilterBannerVisible: boolean): MapInsets => {
  if (typeof window === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const panelBottom = isFilterBannerVisible
    ? PANEL_BOTTOM_FILTERED
    : PANEL_BOTTOM_DEFAULT;
  if (window.innerWidth < MD_BREAKPOINT) {
    return {
      top: 0,
      right: 0,
      bottom: window.innerHeight * 0.6 + panelBottom,
      left: 0,
    };
  }
  return {
    top: 0,
    right: 0,
    bottom: isFilterBannerVisible ? FILTER_BANNER_HEIGHT : 0,
    left: SIDEBAR_LEFT_INSET,
  };
};

type PostsMapShellProps = {
  posts: MapPost[];
  layers: Layer[];
  isAuthenticated: boolean;
  username: string | null;
  userId: string | null;
  avatarObjectKey: string | null;
  children: React.ReactNode;
};

const PostsMapShell = ({
  posts,
  layers,
  isAuthenticated,
  username,
  userId,
  avatarObjectKey,
  children,
}: PostsMapShellProps): React.ReactElement => {
  const params = useParams();
  const selectedPostId =
    typeof params.postId === "string" ? (params.postId as PostId) : null;
  const profileUserId =
    typeof params.userId === "string" ? params.userId : null;

  const [activeLayerIds, setActiveLayerIds] = useState<Set<LayerId>>(
    () => new Set(layers.map((l) => l.id)),
  );
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [focusedPostId, setFocusedPostId] = useState<PostId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultIds, setSearchResultIds] = useState<Set<PostId> | null>(
    null,
  );
  const [isSearchPending, setIsSearchPending] = useState(false);

  const [isWriting, setIsWriting] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(
    null,
  );
  const [isLocationPending, setIsLocationPending] = useState(false);

  const [visibleFeedPostIds, setVisibleFeedPostIds] = useState<PostId[]>([]);

  const mapBoundsRef = useRef<MapBounds | null>(null);
  mapBoundsRef.current = mapBounds;
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleFeedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMapFiltered = mapBounds !== null;
  const isSearchActive = searchResultIds !== null;
  const isPostSelected = selectedPostId !== null;
  const isProfileShowing = profileUserId !== null;
  const isFilterBannerVisible =
    !isWriting && !isProfileShowing && (isMapFiltered || isSearchActive);

  const [mapInsets, setMapInsets] = useState<MapInsets>(() =>
    computeMapInsets(false),
  );
  useEffect(() => {
    const update = (): void =>
      setMapInsets(computeMapInsets(isFilterBannerVisible));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isFilterBannerVisible]);

  const mapPosts = useMemo(() => {
    return posts.filter(
      (p) => p.layer === null || activeLayerIds.has(p.layer.id),
    );
  }, [posts, activeLayerIds]);

  const filteredPosts = useMemo(() => {
    let result = mapPosts;
    if (searchResultIds !== null) {
      result = result.filter((p) => searchResultIds.has(p.id));
    }
    if (mapBounds !== null) {
      result = result.filter(
        (p) =>
          p.latitude >= mapBounds.south &&
          p.latitude <= mapBounds.north &&
          p.longitude >= mapBounds.west &&
          p.longitude <= mapBounds.east,
      );
    }
    return result;
  }, [mapPosts, searchResultIds, mapBounds]);

  const handleUserMove = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleResetMapFilter = useCallback(() => {
    setMapBounds(null);
  }, []);

  const handlePostFocus = useCallback((postId: PostId) => {
    if (mapBoundsRef.current !== null) return;
    if (focusTimeoutRef.current !== null) clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = setTimeout(() => {
      setFocusedPostId(postId);
    }, 120);
  }, []);

  const handleVisiblePostIdsChange = useCallback((ids: PostId[]) => {
    if (mapBoundsRef.current !== null) return;
    if (visibleFeedTimeoutRef.current !== null)
      clearTimeout(visibleFeedTimeoutRef.current);
    visibleFeedTimeoutRef.current = setTimeout(() => {
      setVisibleFeedPostIds(ids);
    }, 150);
  }, []);

  const toggleLayer = useCallback((layerId: LayerId) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchDebounceRef.current !== null)
      clearTimeout(searchDebounceRef.current);
    if (query.trim() === "") {
      setSearchResultIds(null);
      setIsSearchPending(false);
      return;
    }
    setIsSearchPending(true);
    searchDebounceRef.current = setTimeout(() => {
      searchPostIds(query).then((ids) => {
        setSearchResultIds(new Set(ids));
        setIsSearchPending(false);
      });
    }, 300);
  }, []);

  const handleStartWriting = useCallback(() => {
    setIsWriting(true);
    setPickedLocation(null);
    setIsLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocationPending(false);
      },
      () => {
        // GPS 실패 시 사용자가 지도를 탭해 직접 선택
        setIsLocationPending(false);
      },
      { timeout: 8000 },
    );
  }, []);

  const handleCloseWriting = useCallback(() => {
    setIsWriting(false);
    setPickedLocation(null);
    setIsLocationPending(false);
  }, []);

  const handleLocationPick = useCallback(
    (latitude: number, longitude: number) => {
      setPickedLocation({ latitude, longitude });
    },
    [],
  );

  const activePostId = selectedPostId ?? focusedPostId;

  // Panel key for AnimatePresence: four exclusive states
  const panelKey = isPostSelected
    ? "post-detail"
    : isProfileShowing
      ? "user-profile"
      : isWriting
        ? "write-form"
        : "post-list";

  return (
    <div className="relative h-full overflow-hidden">
      {/* User menu — top right */}
      {username !== null && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end">
          <div className="pointer-events-auto">
            <UserMenu
              username={username}
              userId={userId ?? ""}
              avatarObjectKey={avatarObjectKey}
            />
          </div>
        </div>
      )}

      {/* Full-bleed map */}
      <div className="absolute inset-0">
        <PostMap
          posts={mapPosts}
          activePostId={activePostId}
          selectedPostId={selectedPostId}
          visibleFeedPostIds={visibleFeedPostIds}
          insets={mapInsets}
          isFiltered={isMapFiltered}
          isLocationPickMode={isWriting}
          pickedLocation={pickedLocation}
          onUserMove={handleUserMove}
          onLocationPick={handleLocationPick}
        />
      </div>

      {/* Filter toast bar — bottom center of the map */}
      <AnimatePresence>
        {isFilterBannerVisible && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-50"
          >
            <div className="pointer-events-auto flex items-center gap-3 border-t border-zinc-200/60 bg-white/85 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/80">
              <span className="text-xs text-postech-700 dark:text-postech-300">
                {isSearchActive && isMapFiltered
                  ? `검색 · 지도 필터 · ${filteredPosts.length}개`
                  : isSearchActive
                    ? `검색 결과 · ${filteredPosts.length}개`
                    : `지도 필터 · ${filteredPosts.length}개`}
              </span>
              <div className="flex items-center gap-2">
                {isSearchActive && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="text-xs text-postech-600 underline-offset-2 transition-colors hover:underline dark:text-postech-400"
                  >
                    검색 초기화
                  </button>
                )}
                {isMapFiltered && (
                  <button
                    type="button"
                    onClick={handleResetMapFilter}
                    className="text-xs text-postech-600 underline-offset-2 transition-colors hover:underline dark:text-postech-400"
                  >
                    지도 초기화
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating UI — each element is an independent glass component */}
      <motion.div
        animate={{ bottom: isFilterBannerVisible ? 53 : 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex h-[60vh] flex-col gap-2 overflow-hidden md:h-auto md:inset-y-3 md:right-auto md:w-80"
      >
        {/* Main content panel */}
        <AnimatePresence mode="wait" initial={false}>
          {panelKey === "post-detail" && (
            <motion.div
              key="post-detail"
              className="flex min-h-0 flex-1 flex-col gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* Post content */}
              <div className="glass pointer-events-auto min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45">
                <div className="h-full overflow-y-auto overscroll-contain">
                  {children}
                </div>
              </div>
            </motion.div>
          )}

          {panelKey === "user-profile" && (
            <motion.div
              key="user-profile"
              className="flex min-h-0 flex-1 flex-col gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          )}

          {panelKey === "write-form" && (
            <motion.div
              key="write-form"
              className="glass pointer-events-auto min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <WritePostPanel
                layers={layers}
                pickedLocation={pickedLocation}
                isLocationPending={isLocationPending}
                isAuthenticated={isAuthenticated}
                avatarObjectKey={avatarObjectKey}
                onRequestClose={handleCloseWriting}
              />
            </motion.div>
          )}

          {panelKey === "post-list" && (
            <motion.div
              key="post-list"
              className="flex min-h-0 flex-1 flex-col gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* Post list */}
              <div className="glass pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45">
                <PostList
                  posts={filteredPosts}
                  focusedPostId={focusedPostId}
                  isMapFiltered={isMapFiltered}
                  isAuthenticated={isAuthenticated}
                  onPostFocus={handlePostFocus}
                  onVisiblePostIdsChange={handleVisiblePostIdsChange}
                />
              </div>
              {/* Search bar */}
              <div className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45">
                <SearchBar
                  value={searchQuery}
                  onChange={handleSearchChange}
                  isPending={isSearchPending}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layer filter chips — hidden while writing, viewing a post, or viewing a profile */}
        {!isWriting &&
          !isPostSelected &&
          !isProfileShowing &&
          layers.length > 0 && (
            <div className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-black/8 bg-white/55 backdrop-blur-xl backdrop-saturate-200 dark:border-white/10 dark:bg-zinc-900/45">
              <div
                className="flex flex-wrap auto-cols-max grid-rows-2 gap-1.5 overflow-x-auto px-4 py-2.5 [grid-auto-flow:column]"
                style={{ scrollbarWidth: "none" }}
              >
                {layers.map((layer) => {
                  const active = activeLayerIds.has(layer.id);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      title={layer.description}
                      onClick={() => toggleLayer(layer.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-postech-600 text-white"
                          : "bg-black/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                      }`}
                    >
                      {layer.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {/* Write CTA bar — visible on post-list */}
        {panelKey === "post-list" && (
          isAuthenticated ? (
            <button
              type="button"
              onClick={handleStartWriting}
              className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-postech-400/40 bg-postech-600/85 backdrop-blur-xl backdrop-saturate-200 transition-colors hover:bg-postech-600/95 dark:border-postech-500/30 dark:bg-postech-700/75 dark:hover:bg-postech-700/90"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <PenLine className="h-4 w-4 shrink-0 text-white/90" />
                  <span className="text-sm font-semibold text-white">
                    새 글 쓰기
                  </span>
                </div>
                <span className="text-xs text-white/55"></span>
              </div>
            </button>
          ) : (
            <a
              href="/login"
              className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-postech-400/40 bg-postech-600/85 backdrop-blur-xl backdrop-saturate-200 transition-colors hover:bg-postech-600/95 dark:border-postech-500/30 dark:bg-postech-700/75 dark:hover:bg-postech-700/90"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <LogIn className="h-4 w-4 shrink-0 text-white/90" />
                  <span className="text-sm font-semibold text-white">
                    로그인
                  </span>
                </div>
              </div>
            </a>
          )
        )}
      </motion.div>
    </div>
  );
};

export default PostsMapShell;
