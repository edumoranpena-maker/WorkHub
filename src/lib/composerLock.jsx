/**
 * composerLock.jsx
 *
 * While a Crear/Editar Update or Crear/Editar Subtema composer is open,
 * switching sections (nav chips, sidebar, mobile tab swipe) must be
 * completely disabled — regardless of whether the composer has content.
 *
 * The Post composer (mode="post", create or edit) is a fullscreen overlay
 * that already sits on top of everything, so it isn't wired into this lock —
 * this is specifically for Update/Subtema per product decision.
 *
 * Counter-based so nested/overlapping locks (shouldn't normally happen, but
 * cheap insurance) can't unlock each other prematurely.
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";

const ComposerLockContext = createContext(null);

export function ComposerLockProvider({ children }) {
  const [count, setCount] = useState(0);
  const lock   = useCallback(() => setCount(c => c + 1), []);
  const unlock = useCallback(() => setCount(c => Math.max(0, c - 1)), []);
  return (
    <ComposerLockContext.Provider value={{ locked: count > 0, lock, unlock }}>
      {children}
    </ComposerLockContext.Provider>
  );
}

export function useComposerLock() {
  const ctx = useContext(ComposerLockContext);
  if (!ctx) throw new Error("useComposerLock() must be used inside <ComposerLockProvider>");
  return ctx;
}

/**
 * Convenience hook for the composer itself: locks navigation for as long as
 * `active` stays true, always unlocking on unmount even if closed abruptly.
 */
export function useComposerNavLock(active) {
  const { lock, unlock } = useComposerLock();
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active, lock, unlock]);
}
