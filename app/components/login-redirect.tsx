"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Renders a blank screen for a single frame, then redirects to /login
// with the current path encoded as ?from=. This client component is used
// because server components cannot read their own pathname without middleware.
const LoginRedirect = (): React.ReactElement => {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/login?from=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);

  return <div className="h-screen bg-zinc-100 dark:bg-zinc-950" />;
};

export default LoginRedirect;
