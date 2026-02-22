"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "leaflet";
import "leaflet.markercluster";
import type { MapPost } from "@/database/queries/map";
import type { PostId } from "@/database/types";
import type { MapBounds } from "@/app/posts/types";
const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

// Adjusts a target lat/lng so it visually appears at the center of the
// unoccluded area instead of the map container center.
const adjustLatLngForInsets = (
  map: L.Map,
  latLng: L.LatLngExpression,
  zoom: number,
  insets: MapInsets,
): L.LatLng => {
  const dx = (insets.left - insets.right) / 2;
  const dy = (insets.top - insets.bottom) / 2;
  const px = map.project(latLng, zoom);
  return map.unproject(px.subtract(L.point(dx, dy)), zoom);
};

type MapControllerProps = {
  posts: MapPost[];
  selectedPostId: PostId | null;
  visibleFeedPostIds: PostId[];
  insets: MapInsets;
  onUserMove: (bounds: MapBounds) => void;
};

const MapController = ({
  posts,
  selectedPostId,
  visibleFeedPostIds,
  insets,
  onUserMove,
}: MapControllerProps): null => {
  const map = useMap();
  const isProgrammatic = useRef(false);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  // Fit all posts on initial mount
  useEffect(() => {
    if (postsRef.current.length === 0) return;
    isProgrammatic.current = true;
    if (postsRef.current.length === 1) {
      const zoom = 16;
      const adjusted = adjustLatLngForInsets(
        map,
        [postsRef.current[0].latitude, postsRef.current[0].longitude],
        zoom,
        insetsRef.current,
      );
      map.setView(adjusted, zoom);
      return;
    }
    const lats = postsRef.current.map((p) => p.latitude);
    const lngs = postsRef.current.map((p) => p.longitude);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      {
        paddingTopLeft: [insetsRef.current.left + 48, insetsRef.current.top + 48],
        paddingBottomRight: [insetsRef.current.right + 48, insetsRef.current.bottom + 48],
      },
    );
  }, [map]);

  // Pan to selected post (URL-driven, higher zoom)
  useEffect(() => {
    if (selectedPostId === null) return;
    const post = postsRef.current.find((p) => p.id === selectedPostId);
    if (post === undefined) return;
    isProgrammatic.current = true;
    const zoom = 17;
    const adjusted = adjustLatLngForInsets(
      map,
      [post.latitude, post.longitude],
      zoom,
      insetsRef.current,
    );
    map.flyTo(adjusted, zoom, { duration: 0.6 });
  }, [selectedPostId, map]);

  // Pan to fit visible feed posts (scroll-driven, only when no post is selected)
  useEffect(() => {
    if (selectedPostId !== null) return;
    if (visibleFeedPostIds.length === 0) return;

    const visible = visibleFeedPostIds
      .map((id) => postsRef.current.find((p) => p.id === id))
      .filter((p): p is MapPost => p !== undefined);

    if (visible.length === 0) return;

    isProgrammatic.current = true;

    if (visible.length === 1) {
      const zoom = 16;
      const adjusted = adjustLatLngForInsets(
        map,
        [visible[0].latitude, visible[0].longitude],
        zoom,
        insetsRef.current,
      );
      map.flyTo(adjusted, zoom, { duration: 0.5 });
      return;
    }

    const lats = visible.map((p) => p.latitude);
    const lngs = visible.map((p) => p.longitude);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      {
        paddingTopLeft: [
          insetsRef.current.left + 48,
          insetsRef.current.top + 48,
        ],
        paddingBottomRight: [
          insetsRef.current.right + 48,
          insetsRef.current.bottom + 48,
        ],
        maxZoom: 16,
        animate: true,
        duration: 0.5,
      },
    );
  }, [visibleFeedPostIds, selectedPostId, map]);

  useMapEvents({
    dragstart: () => {
      isProgrammatic.current = false;
    },
    moveend: () => {
      if (isProgrammatic.current) {
        isProgrammatic.current = false;
        return;
      }
      const bounds = map.getBounds();
      onUserMove({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
  });

  return null;
};

const makeMarkerIcon = (isSelected: boolean, isActive: boolean): L.DivIcon => {
  const size = isSelected ? 22 : isActive ? 18 : 14;
  const fill = isSelected
    ? "oklch(48% 0.176 2)"
    : isActive
      ? "oklch(63% 0.140 2)"
      : "#a1a1aa";
  const stroke = isSelected
    ? "oklch(40% 0.165 2)"
    : isActive
      ? "oklch(48% 0.176 2)"
      : "#71717a";
  const strokeWidth = isSelected ? 3 : 1.5;
  const opacity = isSelected || isActive ? 0.9 : 0.7;
  const r = size / 2 - strokeWidth / 2;

  return L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="${strokeWidth}"/></svg>`,
    className: "",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
    popupAnchor: L.point(0, -size / 2),
  });
};

type ClusterLayerProps = {
  posts: MapPost[];
  activePostId: PostId | null;
  selectedPostId: PostId | null;
  isLocationPickMode: boolean;
  onNavigate: (postId: PostId) => void;
};

const ClusterLayer = ({
  posts,
  activePostId,
  selectedPostId,
  isLocationPickMode,
  onNavigate,
}: ClusterLayerProps): null => {
  const map = useMap();
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const isLocationPickModeRef = useRef(isLocationPickMode);
  isLocationPickModeRef.current = isLocationPickMode;

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (group) => {
        const count = group.getChildCount();
        const size = count >= 100 ? 44 : count >= 10 ? 38 : 32;
        const r = size / 2 - 2;
        const fontSize = size <= 32 ? 11 : 13;
        return L.divIcon({
          html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="oklch(48% 0.176 2)" fill-opacity="0.85" stroke="oklch(40% 0.165 2)" stroke-width="2"/><text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fontSize}" font-family="sans-serif" font-weight="600">${count}</text></svg>`,
          className: "",
          iconSize: L.point(size, size),
          iconAnchor: L.point(size / 2, size / 2),
        });
      },
    });

    for (const post of posts) {
      const isSelected = selectedPostId === post.id;
      const isActive = activePostId === post.id;
      const icon = makeMarkerIcon(isSelected, isActive);

      const marker = L.marker([post.latitude, post.longitude], { icon });
      marker.on("click", (event) => {
        if (isLocationPickModeRef.current) {
          L.DomEvent.stopPropagation(event);
          return;
        }
        onNavigateRef.current(post.id);
      });

      cluster.addLayer(marker);
    }

    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [posts, activePostId, selectedPostId, map]);

  return null;
};

export type PickedLocation = {
  latitude: number;
  longitude: number;
};

export type MapInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type LocationPickerLayerProps = {
  pickedLocation: PickedLocation | null;
  onLocationPick: (latitude: number, longitude: number) => void;
};

const makePickedLocationIcon = (): L.DivIcon => {
  const size = 20;
  const r = size / 2 - 2;
  return L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="oklch(55% 0.18 240)" fill-opacity="0.9" stroke="oklch(40% 0.15 240)" stroke-width="2.5"/></svg>`,
    className: "",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
};

const LocationPickerLayer = ({
  pickedLocation,
  onLocationPick,
}: LocationPickerLayerProps): null => {
  const map = useMap();
  const onLocationPickRef = useRef(onLocationPick);
  onLocationPickRef.current = onLocationPick;

  useMapEvents({
    click: (event) => {
      onLocationPickRef.current(event.latlng.lat, event.latlng.lng);
    },
  });

  useEffect(() => {
    if (pickedLocation === null) return;
    const marker = L.marker(
      [pickedLocation.latitude, pickedLocation.longitude],
      { icon: makePickedLocationIcon(), zIndexOffset: 1000 },
    );
    marker.addTo(map);
    return () => {
      map.removeLayer(marker);
    };
  }, [pickedLocation, map]);

  return null;
};

type PostMapProps = {
  posts: MapPost[];
  activePostId: PostId | null;
  selectedPostId: PostId | null;
  visibleFeedPostIds: PostId[];
  insets: MapInsets;
  isFiltered: boolean;
  isLocationPickMode: boolean;
  pickedLocation: PickedLocation | null;
  onUserMove: (bounds: MapBounds) => void;
  onLocationPick: (latitude: number, longitude: number) => void;
};

const PostMap = ({
  posts,
  activePostId,
  selectedPostId,
  visibleFeedPostIds,
  insets,
  isFiltered,
  isLocationPickMode,
  pickedLocation,
  onUserMove,
  onLocationPick,
}: PostMapProps): React.ReactElement => {
  const router = useRouter();

  const handleNavigate = useCallback(
    (postId: PostId) => {
      router.push(`/posts/${postId}`);
    },
    [router],
  );

  const initialCenter: [number, number] =
    posts.length > 0
      ? [
          posts.reduce((s, p) => s + p.latitude, 0) / posts.length,
          posts.reduce((s, p) => s + p.longitude, 0) / posts.length,
        ]
      : [0, 0];

  const initialZoom = posts.length > 0 ? 13 : 2;

  return (
    <div className="relative h-full w-full">
      {isFiltered && (
        <div className="pointer-events-none absolute inset-0 z-[1000] rounded-[inherit] ring-2 ring-inset ring-postech-500" />
      )}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        zoomControl={false}
        className={`h-full w-full${isLocationPickMode ? " cursor-crosshair" : ""}`}
        style={{ zIndex: 0 }}
      >
        <TileLayer
          url={DARK_TILE_URL}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />
        <MapController
          posts={posts}
          selectedPostId={selectedPostId}
          visibleFeedPostIds={visibleFeedPostIds}
          insets={insets}
          onUserMove={onUserMove}
        />
        <ClusterLayer
          posts={posts}
          activePostId={activePostId}
          selectedPostId={selectedPostId}
          isLocationPickMode={isLocationPickMode}
          onNavigate={handleNavigate}
        />
        {isLocationPickMode && (
          <LocationPickerLayer
            pickedLocation={pickedLocation}
            onLocationPick={onLocationPick}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default PostMap;
