"use client";

import Link from "next/link";

type UserMenuProps = {
  username: string;
  userId: string;
  avatarObjectKey: string | null;
};

const UserMenu = ({ username, userId, avatarObjectKey }: UserMenuProps): React.ReactElement => {
  return (
    <Link
      href={`/${userId}`}
      aria-label="내 프로필"
      className="block h-8 w-8 overflow-hidden rounded-full transition-opacity hover:opacity-85"
    >
      <img
        src={
          avatarObjectKey
            ? `/api/avatar?key=${encodeURIComponent(avatarObjectKey)}`
            : "/default-avatar.png"
        }
        alt={username}
        className="h-full w-full object-cover"
      />
    </Link>
  );
};

export default UserMenu;
