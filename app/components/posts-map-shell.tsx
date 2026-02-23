"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import type { MapPost, Layer } from "@/database/queries/map";
import type { LayerId, PostId } from "@/database/types";
import type { MapBounds } from "@/app/posts/types";
import type { PickedLocation, MapInsets } from "@/app/components/post-map";
import { PenLine, LogIn, RefreshCw } from "lucide-react";
import { searchPostIds } from "@/app/actions/posts";
import PostList from "@/app/components/post-list";
import UserMenu from "@/app/components/user-menu";
import SearchBar from "@/app/components/search-bar";
import WritePostPanel from "@/app/components/write-post-panel";
import {
  buildLayerFilterHash,
  parseActiveLayerIdsFromHash,
} from "@/app/posts/layer-filter-hash";

const PostMap = dynamic(() => import("@/app/components/post-map"), {
  ssr: false,
});

// PANEL_BOTTOM_* matches the `animate={{ bottom }}` values in the floating container.
// FILTER_BANNER_HEIGHT ≈ PANEL_BOTTOM_FILTERED - PANEL_BOTTOM_DEFAULT (41px).
const PANEL_BOTTOM_DEFAULT = 12;
const PANEL_BOTTOM_FILTERED = 53;
const FILTER_BANNER_HEIGHT = PANEL_BOTTOM_FILTERED - PANEL_BOTTOM_DEFAULT;
const DETAIL_PANEL_BOTTOM_DEFAULT = 8;
const DETAIL_PANEL_BOTTOM_FILTERED =
  DETAIL_PANEL_BOTTOM_DEFAULT + FILTER_BANNER_HEIGHT;
// Tailwind md breakpoint (px)
const MD_BREAKPOINT = 768;
// Mobile floating panel height as a fraction of viewport height
const MOBILE_PANEL_HEIGHT_RATIO = 0.9;
// Desktop sidebar: inset-x-3 (12px) + w-80 (320px)
const SIDEBAR_LEFT_INSET = 332;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING_PANEL = {
  type: "spring",
  stiffness: 320,
  damping: 34,
  mass: 0.8,
} as const;
const SPRING_ITEM = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.65,
} as const;
const FEED_POLL_INTERVAL_MS = 30_000;

type FeedPollingResponse = {
  hasNewPosts: boolean;
  newPostCount: number;
  latestCreatedAt: number | null;
  latestPostId: string | null;
};

const getViewportHeight = (): number => {
  if (typeof window === "undefined") return 0;
  const visualHeight = window.visualViewport?.height;
  if (visualHeight !== undefined && visualHeight > 0) {
    return Math.round(visualHeight);
  }
  return Math.round(window.innerHeight);
};

const getViewportWidth = (): number => {
  if (typeof window === "undefined") return 0;
  const visualWidth = window.visualViewport?.width;
  if (visualWidth !== undefined && visualWidth > 0) {
    return Math.round(visualWidth);
  }
  return Math.round(window.innerWidth);
};

const getSafeAreaInsetBottom = (): number => {
  if (typeof window === "undefined") return 0;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--safe-area-inset-bottom")
    .trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const computeMapInsets = (
  isFilterBannerVisible: boolean,
  viewportHeight: number,
  viewportWidth: number,
  safeAreaInsetBottom: number,
): MapInsets => {
  const panelBottom = isFilterBannerVisible
    ? PANEL_BOTTOM_FILTERED
    : PANEL_BOTTOM_DEFAULT;
  if (viewportWidth < MD_BREAKPOINT) {
    return {
      top: 0,
      right: 0,
      bottom:
        viewportHeight * MOBILE_PANEL_HEIGHT_RATIO +
        panelBottom +
        safeAreaInsetBottom,
      left: 0,
    };
  }
  return {
    top: 0,
    right: 0,
    bottom:
      (isFilterBannerVisible ? FILTER_BANNER_HEIGHT : 0) + safeAreaInsetBottom,
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
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const params = useParams();
  const selectedPostId =
    typeof params.postId === "string" ? (params.postId as PostId) : null;
  const profileUserId =
    typeof params.userId === "string" ? params.userId : null;

  const [activeLayerIds, setActiveLayerIds] = useState<Set<LayerId>>(() => {
    const allLayerIds = layers.map((layer) => layer.id);
    if (typeof window === "undefined") return new Set(allLayerIds);
    return (
      parseActiveLayerIdsFromHash(window.location.hash, allLayerIds) ??
      new Set(allLayerIds)
    );
  });
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
  const [newPostCount, setNewPostCount] = useState(0);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

  const [visibleFeedPostIds, setVisibleFeedPostIds] = useState<PostId[]>([]);

  const mapBoundsRef = useRef<MapBounds | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleFeedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedSnapshotRef = useRef<{ createdAt: number; postId: string | null }>({
    createdAt: 0,
    postId: null,
  });

  const isMapFiltered = mapBounds !== null;
  const isSearchActive = searchResultIds !== null;
  const isPostSelected = selectedPostId !== null;
  const isProfileShowing = profileUserId !== null;
  const isFilterBannerVisible =
    !isWriting && !isProfileShowing && (isMapFiltered || isSearchActive);
  const panelKey = isPostSelected
    ? "post-detail"
    : isProfileShowing
      ? "user-profile"
      : isWriting
        ? "write-form"
        : "post-list";

  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    getViewportHeight(),
  );
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    getViewportWidth(),
  );
  const [safeAreaInsetBottom, setSafeAreaInsetBottom] = useState<number>(() =>
    getSafeAreaInsetBottom(),
  );
  const [mapInsets, setMapInsets] = useState<MapInsets>(() => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }));
  const allLayerIds = useMemo(() => layers.map((layer) => layer.id), [layers]);

  useEffect(() => {
    mapBoundsRef.current = mapBounds;
  }, [mapBounds]);

  useEffect(() => {
    const feedHead = posts[0];
    feedSnapshotRef.current = {
      createdAt: feedHead?.createdAt ?? 0,
      postId: feedHead?.id ?? null,
    };
    setNewPostCount(0);
    setIsRefreshingFeed(false);
  }, [posts]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const handleResize = (): void => {
      setViewportHeight(getViewportHeight());
      setViewportWidth(getViewportWidth());
      setSafeAreaInsetBottom(getSafeAreaInsetBottom());
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    viewport?.addEventListener("resize", handleResize);
    viewport?.addEventListener("scroll", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  useEffect(() => {
    const applyHashToLayerSelection = (): void => {
      const parsedActiveLayerIds = parseActiveLayerIdsFromHash(
        window.location.hash,
        allLayerIds,
      );
      setActiveLayerIds(parsedActiveLayerIds ?? new Set(allLayerIds));
    };

    applyHashToLayerSelection();
    window.addEventListener("hashchange", applyHashToLayerSelection);
    return () => {
      window.removeEventListener("hashchange", applyHashToLayerSelection);
    };
  }, [allLayerIds]);

  useEffect(() => {
    const nextHash = buildLayerFilterHash(
      window.location.hash,
      allLayerIds,
      activeLayerIds,
    );
    if (window.location.hash === nextHash) return;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [activeLayerIds, allLayerIds]);

  useEffect(() => {
    setMapInsets(
      computeMapInsets(
        isFilterBannerVisible,
        viewportHeight,
        viewportWidth,
        safeAreaInsetBottom,
      ),
    );
  }, [
    isFilterBannerVisible,
    viewportHeight,
    viewportWidth,
    safeAreaInsetBottom,
  ]);

  const checkForNewPosts = useCallback(async (): Promise<void> => {
    const snapshot = feedSnapshotRef.current;
    const query = new URLSearchParams({
      sinceCreatedAt: String(snapshot.createdAt),
    });
    if (snapshot.postId !== null) query.set("sincePostId", snapshot.postId);
    const response = await fetch(`/api/feed?${query.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as FeedPollingResponse;
    if (!payload.hasNewPosts || payload.newPostCount <= 0) return;
    setNewPostCount((prev) => Math.max(prev, payload.newPostCount));
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void checkForNewPosts();
    }, FEED_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [checkForNewPosts]);

  const isMobileViewport = viewportWidth < MD_BREAKPOINT;
  const isMobilePostDetail = isMobileViewport && panelKey === "post-detail";
  const mobilePanelHeight = Math.max(
    Math.round(viewportHeight * MOBILE_PANEL_HEIGHT_RATIO),
    280,
  );
  const panelBottomDefault =
    panelKey === "post-detail"
      ? DETAIL_PANEL_BOTTOM_DEFAULT
      : PANEL_BOTTOM_DEFAULT;
  const panelBottomFiltered =
    panelKey === "post-detail"
      ? DETAIL_PANEL_BOTTOM_FILTERED
      : PANEL_BOTTOM_FILTERED;
  const shouldApplyMobileSafeAreaOffset =
    panelKey !== "post-detail" || isFilterBannerVisible;
  const shouldReduceMobilePanelHeightForFilter = panelKey !== "post-detail";
  const floatingPanelBottom = isMobilePostDetail
    ? 0
    : (isFilterBannerVisible ? panelBottomFiltered : panelBottomDefault) +
      (isMobileViewport && shouldApplyMobileSafeAreaOffset
        ? safeAreaInsetBottom
        : 0);
  const floatingPanelDesktopHeight = Math.max(
    viewportHeight - 24 - (isFilterBannerVisible ? FILTER_BANNER_HEIGHT : 0),
    320,
  );
  const floatingPanelMobileHeight = isMobilePostDetail
    ? viewportHeight
    : Math.max(
        mobilePanelHeight -
          (isFilterBannerVisible && shouldReduceMobilePanelHeightForFilter
            ? FILTER_BANNER_HEIGHT
            : 0),
        240,
      );
  const floatingPanelAnimate: { bottom: number; height: number } =
    isMobileViewport
      ? { bottom: floatingPanelBottom, height: floatingPanelMobileHeight }
      : { bottom: floatingPanelBottom, height: floatingPanelDesktopHeight };

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

  const handleRefreshFeed = useCallback(() => {
    setIsRefreshingFeed(true);
    setNewPostCount(0);
    router.refresh();
  }, [router]);

  const activePostId = selectedPostId ?? focusedPostId;

  return (
    <div className="relative h-full overflow-hidden">
      {/* User menu — top right */}
      {username !== null && (
        <motion.div
          className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }
          }
          animate={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <div className="pointer-events-auto">
            <UserMenu
              username={username}
              userId={userId ?? ""}
              avatarObjectKey={avatarObjectKey}
            />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {newPostCount > 0 && panelKey === "post-list" && (
          <motion.div
            className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center md:left-[344px] md:right-3 md:justify-start"
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }
            }
            animate={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? undefined
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            transition={SPRING_ITEM}
          >
            <motion.button
              type="button"
              onClick={handleRefreshFeed}
              whileHover={
                prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              transition={SPRING_ITEM}
              className="glass pointer-events-auto flex items-center gap-2 rounded-full border border-postech-400/35 bg-zinc-900/72 px-3 py-2 text-xs text-postech-100 backdrop-blur-xl backdrop-saturate-200"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshingFeed ? "animate-spin" : ""}`}
              />
              <span>{`새 글 ${newPostCount}개`}</span>
              <span className="text-postech-300/85">새로고침</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

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
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
            transition={SPRING_ITEM}
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]"
          >
            <div className="pointer-events-auto flex items-center gap-3 border-t border-postech-500/40 bg-postech-500/12 px-4 py-2.5 backdrop-blur-xl backdrop-saturate-200">
              <span className="text-xs text-postech-200">
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
                    className="text-xs text-postech-300 underline-offset-2 transition-colors hover:text-postech-100 hover:underline"
                  >
                    검색 초기화
                  </button>
                )}
                {isMapFiltered && (
                  <button
                    type="button"
                    onClick={handleResetMapFilter}
                    className="text-xs text-postech-300 underline-offset-2 transition-colors hover:text-postech-100 hover:underline"
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
        animate={floatingPanelAnimate}
        transition={SPRING_PANEL}
        className="pointer-events-none absolute inset-x-3 z-10 flex flex-col gap-2 overflow-hidden md:right-auto md:w-80"
      >
        {/* Main content panel */}
        <AnimatePresence mode="wait" initial={false}>
          {panelKey === "post-detail" && (
            <motion.div
              key="post-detail"
              className="pointer-events-auto flex min-h-0 flex-1 flex-col"
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 16, scale: 0.985 }
              }
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: 12, scale: 0.992 }
              }
              transition={SPRING_ITEM}
            >
              {children}
            </motion.div>
          )}

          {panelKey === "user-profile" && (
            <motion.div
              key="user-profile"
              className="flex min-h-0 flex-1 flex-col"
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 16, scale: 0.985 }
              }
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: 12, scale: 0.992 }
              }
              transition={SPRING_ITEM}
            >
              {children}
            </motion.div>
          )}

          {panelKey === "write-form" && (
            <motion.div
              key="write-form"
              className="glass pointer-events-auto mt-auto max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-white/55 backdrop-blur-xl backdrop-saturate-200 md:mt-0 bg-zinc-900/45"
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 16, scale: 0.985 }
              }
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: 12, scale: 0.992 }
              }
              transition={SPRING_ITEM}
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
              initial={
                prefersReducedMotion
                  ? false
                  : { opacity: 0, y: 16, scale: 0.985 }
              }
              animate={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? undefined
                  : { opacity: 0, y: 12, scale: 0.992 }
              }
              transition={SPRING_ITEM}
            >
              {/* Post list */}
              <div className="glass pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/55 backdrop-blur-xl backdrop-saturate-200 bg-zinc-900/45">
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
              <div className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/55 backdrop-blur-xl backdrop-saturate-200 bg-zinc-900/45">
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
            <div className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/55 backdrop-blur-xl backdrop-saturate-200 bg-zinc-900/45">
              <div
                className="flex flex-wrap auto-cols-max grid-rows-2 gap-1.5 overflow-x-auto px-4 py-2.5 [grid-auto-flow:column]"
                style={{ scrollbarWidth: "none" }}
              >
                {layers.map((layer) => {
                  const active = activeLayerIds.has(layer.id);
                  return (
                    <motion.button
                      key={layer.id}
                      type="button"
                      title={layer.description}
                      onClick={() => toggleLayer(layer.id)}
                      whileHover={
                        prefersReducedMotion
                          ? undefined
                          : { y: -1.5, scale: active ? 1.01 : 1.035 }
                      }
                      whileTap={
                        prefersReducedMotion ? undefined : { scale: 0.97 }
                      }
                      transition={SPRING_ITEM}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-postech-600 text-white"
                          : "bg-black/5 text-zinc-500 bg-white/10 text-zinc-400"
                      }`}
                    >
                      {layer.name}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

        {/* Write CTA bar — visible on post-list */}
        {panelKey === "post-list" &&
          (isAuthenticated ? (
            <motion.button
              type="button"
              onClick={handleStartWriting}
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              transition={SPRING_ITEM}
              className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-postech-500/30 bg-postech-600/85 backdrop-blur-xl backdrop-saturate-200 transition-colors hover:bg-postech-600/95 bg-postech-700/75 hover:bg-postech-700/90"
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
            </motion.button>
          ) : (
            <motion.a
              href="/login"
              whileHover={
                prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              transition={SPRING_ITEM}
              className="glass pointer-events-auto shrink-0 overflow-hidden rounded-2xl border border-postech-500/30 bg-postech-600/85 backdrop-blur-xl backdrop-saturate-200 transition-colors hover:bg-postech-600/95 bg-postech-700/75 hover:bg-postech-700/90"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <LogIn className="h-4 w-4 shrink-0 text-white/90" />
                  <span className="text-sm font-semibold text-white">
                    로그인
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
      </motion.div>
    </div>
  );
};

export default PostsMapShell;
