import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { setUsername } from "@/app/actions/onboarding";

const OnboardingPage = async (): Promise<React.ReactElement> => {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            닉네임 설정
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            커뮤니티에서 사용할 닉네임을 입력해주세요.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form action={setUsername}>
            <div className="mb-4">
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                닉네임
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                minLength={2}
                maxLength={20}
                placeholder="2~20자, 한글·영문·숫자·_"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-postech-500 focus:outline-none focus:ring-2 focus:ring-postech-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-postech-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-postech-700 active:bg-postech-800"
            >
              시작하기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
