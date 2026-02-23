"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import Avatar from "@/app/components/avatar";

type UserMenuProps = {
  username: string;
  userId: string;
  avatarObjectKey: string | null;
};

const UserMenu = ({ username, userId, avatarObjectKey }: UserMenuProps): React.ReactElement => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { scale: 1.06, y: -1.5 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { type: "spring", stiffness: 420, damping: 28, mass: 0.6 }
      }
    >
      <Link
      href={`/${userId}`}
      aria-label="내 프로필"
      className="block h-8 w-8 overflow-hidden rounded-full transition-opacity hover:opacity-85"
      >
        <Avatar
          avatarObjectKey={avatarObjectKey}
          alt={username}
          className="h-full w-full object-cover"
        />
      </Link>
    </motion.div>
  );
};

export default UserMenu;
