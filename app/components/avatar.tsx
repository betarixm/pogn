"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_AVATAR_SRC = "/default-avatar.png";

export const getAvatarSrc = (avatarObjectKey: string | null | undefined): string =>
  avatarObjectKey
    ? `/api/avatar?key=${encodeURIComponent(avatarObjectKey)}`
    : DEFAULT_AVATAR_SRC;

export type AvatarProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  avatarObjectKey?: string | null;
};

const Avatar = ({
  avatarObjectKey = null,
  alt = "",
  onError,
  ...props
}: AvatarProps): React.ReactElement => {
  const primarySrc = useMemo(() => getAvatarSrc(avatarObjectKey), [avatarObjectKey]);
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      onError={(event) => {
        if (src !== DEFAULT_AVATAR_SRC) {
          setSrc(DEFAULT_AVATAR_SRC);
        }
        onError?.(event);
      }}
    />
  );
};

export default Avatar;
