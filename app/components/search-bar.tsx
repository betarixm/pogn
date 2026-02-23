"use client";

import { Search, Loader } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
 const prefersReducedMotion = useReducedMotion();
 return (
 <motion.div
 className="relative flex items-center"
 whileHover={prefersReducedMotion ? undefined : { scale: 1.005 }}
 transition={
 prefersReducedMotion
 ? undefined
 : { type: "spring", stiffness: 420, damping: 36, mass: 0.6 }
 }
 >
 <Search
 className="pointer-events-none absolute left-3 h-3.5 w-3.5 shrink-0 text-zinc-500"
 aria-hidden="true"
 />
 <motion.div
 aria-hidden="true"
 className="pointer-events-none absolute bottom-0 left-3 right-3 h-px origin-left bg-gradient-to-r from-postech-400/10 via-postech-300/45 to-postech-400/10"
 initial={false}
 animate={
 prefersReducedMotion
 ? undefined
 : value.length > 0
 ? { scaleX: 1, opacity: 1 }
 : { scaleX: 0.4, opacity: 0.35 }
 }
 transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
 />
 <input
 type="search"
 value={value}
 onChange={(e) => onChange(e.target.value)}
 placeholder="검색..."
 className="w-full bg-transparent py-2.5 pl-8 pr-8 text-sm text-zinc-100 placeholder-zinc-500 outline-none caret-zinc-100 [&::-webkit-search-cancel-button]:appearance-none"
 aria-label="게시글 검색"
 />
 <AnimatePresence mode="wait" initial={false}>
 {isPending && (
 <motion.div
 key="loading"
 initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
 animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
 exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.7 }}
 transition={{ duration: 0.2 }}
 className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
 >
 <Loader
 className="h-3.5 w-3.5 animate-spin text-zinc-500"
 aria-hidden="true"
 />
 </motion.div>
 )}
 {!isPending && value.length > 0 && (
 <motion.button
 key="clear"
 type="button"
 onClick={() => onChange("")}
 initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
 animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
 exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.7 }}
 whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
 whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
 transition={{ duration: 0.18 }}
 className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
 aria-label="검색어 지우기"
 >
 ×
 </motion.button>
 )}
 </AnimatePresence>
 </motion.div>
 );
};

export default SearchBar;
