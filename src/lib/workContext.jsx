/**
 * workContext.jsx
 *
 * Unified Work Context Persistence — the single system every section (and any
 * component within them) uses to remember "what was I doing" across a section
 * switch, instead of each section inventing its own scroll-restore or
 * draft-restore logic.
 *
 * Design
 * ------
 * One Provider, mounted once near the app root (RootShell), holding an
 * in-memory Map keyed by an arbitrary string key. Because it's a plain JS Map
 * (not localStorage/sessionStorage), values are never serialized — real File
 * objects, Blobs, object-URLs, functions, whatever — can be stored as-is. That
 * matters here specifically because Update/Subtema/Post composer drafts can
 * hold attached File objects that wouldn't survive JSON serialization anyway.
 *
 * Any component — a whole section (`"recaps"`), a specific open thread
 * (`"recaps:thread:<id>"`), a specific open composer instance
 * (`"recaps:composer:update:<threadId>"`) — calls useSectionMemory with its
 * own key. No central schema, no per-section special-casing: the same hook,
 * the same TTL, the same restore/expire rule, everywhere. That's what makes
 * this "the one system" instead of N independent ones — new sections or new
 * nested pieces of state opt in by calling the same hook with a new key,
 * nothing else to build.
 *
 * First entry vs. return
 * -----------------------
 * - No entry yet, or entry older than TTL_MS  → initialFactory() (fresh state).
 * - Entry exists and is within TTL_MS          → that stored state (exact restore).
 *
 * The TTL clock resets on every change *and* again on unmount (leaving the
 * section) — so the window is measured from "the moment you stopped touching
 * this", matching "si regreso dentro de un tiempo prudente".
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const TTL_MS = 12 * 60 * 1000; // 12 minutes — within the requested 10–15 min window

const WorkContextStoreCtx = createContext(null);

export function WorkContextProvider({ children }) {
  // A ref (not React state) — writes here must never trigger a re-render of
  // the whole app; each consumer manages its own local re-renders and just
  // writes through to this shared store as a side channel.
  const store = useRef(new Map()); // key -> { data, savedAt }
  return (
    <WorkContextStoreCtx.Provider value={store}>
      {children}
    </WorkContextStoreCtx.Provider>
  );
}

/**
 * Drop-in replacement for useState that also persists across unmount/remount,
 * for as long as the TTL window hasn't elapsed.
 *
 *   const [ctx, setCtx] = useSectionMemory("recaps", () => ({ scrollTop: 0 }));
 *   setCtx(prev => ({ ...prev, scrollTop: 240 }));
 */
export function useSectionMemory(key, initialFactory) {
  const store = useContext(WorkContextStoreCtx);
  if (!store) throw new Error("useSectionMemory() must be used inside <WorkContextProvider>");

  const [state, setState] = useState(() => {
    const entry = store.current.get(key);
    if (entry && (Date.now() - entry.savedAt) < TTL_MS) {
      return entry.data; // within the memory window — restore exactly
    }
    if (entry) store.current.delete(key); // expired — drop the stale entry
    return typeof initialFactory === "function" ? initialFactory() : initialFactory;
  });

  // Every change re-timestamps the entry — the TTL window only starts
  // counting once you actually stop touching this piece of state.
  useEffect(() => {
    store.current.set(key, { data: state, savedAt: Date.now() });
  }, [key, state, store]);

  // Also re-timestamp on unmount (the moment you actually leave), so quickly
  // switching away and back doesn't cost any of the window.
  useEffect(() => {
    return () => {
      const entry = store.current.get(key);
      if (entry) store.current.set(key, { ...entry, savedAt: Date.now() });
    };
  }, [key, store]);

  return [state, setState];
}

/** Explicitly forget a piece of context (e.g. after a thread is deleted). */
export function useClearSectionMemory() {
  const store = useContext(WorkContextStoreCtx);
  return useCallback((key) => { store?.current?.delete(key); }, [store]);
}
