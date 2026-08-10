/**
 * _debug.js — TEMPORARY diagnostic instrumentation for the freeze
 * investigation. Not part of the feature. Delete this file and every
 * `[CHECKLIST-DEBUG]` call site once the cause is found — grep
 * "CHECKLIST-DEBUG" to find every place this was wired in.
 *
 * Everything logs through one place so removal is: delete this file, delete
 * the imports, delete the call sites. Nothing here changes behavior — every
 * function either returns a no-op value or just calls console.log/useRef.
 */
import { useRef, useEffect } from "react";

const T0 = Date.now();
const t = () => `+${((Date.now() - T0) / 1000).toFixed(2)}s`;

export function dlog(tag, ...args) {
  console.log(`[CHECKLIST-DEBUG ${t()}] ${tag}`, ...args);
}

/** Call at the top of a component body. Logs every render with a running
 *  count for THIS component instance (resets to 1 on remount — a jump back
 *  to 1 after a "closed" log means it really did unmount, a count that
 *  keeps climbing after the portal is supposedly closed means it didn't). */
export function useRenderLog(name, extra) {
  const count = useRef(0);
  count.current += 1;
  dlog(`RENDER ${name} #${count.current}`, extra ?? "");
  return count.current;
}

/** Call at the top of a component body. Logs once on mount, once on
 *  unmount (with how long it was alive) — the direct answer to "¿ToolPortal
 *  conserva el componente montado después de cerrarlo?" */
export function useMountLog(name) {
  useEffect(() => {
    const mountedAt = Date.now();
    dlog(`MOUNT ${name}`);
    return () => dlog(`UNMOUNT ${name}`, `(alive ${((Date.now() - mountedAt) / 1000).toFixed(2)}s)`);
  }, [name]);
}
