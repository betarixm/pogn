"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const LoginFormContent = (): React.ReactElement => {
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  // Only allow relative paths to prevent open-redirect attacks.
  const callbackURL = rawFrom?.startsWith("/") ? rawFrom : "/posts";

  const handleLogin = async (): Promise<void> => {
    await authClient.signIn.social({
      provider: "microsoft",
      callbackURL,
      newUserCallbackURL: "/onboarding",
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 drop-shadow dark:text-zinc-100">
            포근
          </h1>
          <p className="text-sm text-zinc-600 drop-shadow dark:text-zinc-300">
            포스텍 근처의 포근
          </p>
        </div>

        <div className="rounded-2xl border border-white/30 bg-white/55 p-6 shadow-sm backdrop-blur-xl backdrop-saturate-200 dark:border-white/8 dark:bg-zinc-900/45">
          <p className="mb-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            POSTECH 계정으로 로그인하세요.
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 23 23"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path fill="#f3f3f3" d="M0 0h23v23H0z" />
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Microsoft 계정으로 로그인
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500 drop-shadow dark:text-zinc-400">
          @postech.ac.kr 계정만 허용됩니다.
        </p>
      </div>
    </div>
  );
};

// useSearchParams() requires a Suspense boundary.
const LoginForm = (): React.ReactElement => (
  <Suspense>
    <LoginFormContent />
  </Suspense>
);

export default LoginForm;
