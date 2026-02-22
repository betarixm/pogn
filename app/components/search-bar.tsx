"use client";

import { Search, Loader } from "lucide-react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  isPending: boolean;
};

const SearchBar = ({
  value,
  onChange,
  isPending,
}: SearchBarProps): React.ReactElement => {
  return (
    <div className="relative flex items-center">
      <Search
        className="pointer-events-none absolute left-3 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="검색..."
        className="w-full bg-transparent py-2.5 pl-8 pr-7 text-sm text-zinc-800 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-600 [&::-webkit-search-cancel-button]:appearance-none"
        aria-label="게시글 검색"
      />
      {isPending && (
        <Loader
          className="absolute right-3 h-3.5 w-3.5 animate-spin text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        />
      )}
      {!isPending && value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 flex h-5 w-5 items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          aria-label="검색어 지우기"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default SearchBar;
