/**
 * navigation.jsx
 *
 * The ONE navigation system for PlanSpace — replaces the old ad-hoc
 * per-section "deep link" plumbing (openThreadId props, a one-off
 * router.js) with a general, reusable engine. Three independent concerns,
 * deliberately kept together so nothing else in the app reimplements any of
 * them:
 *
 *   1. ROUTES — a flat table of path templates with parent links. Matched
 *      against window.location.pathname to reconstruct which instance the
 *      user is looking at (deep link / refresh support), and walked to
 *      compute "what's the parent of this instance" for Back.
 *
 *   2. Overlay stack — composers, sheets, and the fullscreen media viewer
 *      register themselves here when they open (useOverlayBack, below).
 *      The single physical Android/browser back button is a SINGLE global
 *      popstate listener that ALWAYS checks this stack first: if anything
 *      is on it, back closes only the top entry and never touches page
 *      navigation. Opening an overlay pushes one "guard" history entry
 *      (same URL, just a marker in `state` — never a fake path) so a real
 *      popstate exists for that back press to consume.
 *
 *      Critically: EVERY dismissal path — the physical back button, an X
 *      button, a Cancel/Save button — goes through the exact same
 *      mechanism (goBack() / dismissOverlay()), which is what keeps them
 *      from ever drifting apart into two different behaviors. A UI close
 *      button doesn't "close itself"; it simulates the same back-press the
 *      hardware button would have produced.
 *
 *   3. Scroll restoration — an in-memory Map<path, scrollY>, saved
 *      continuously per scrollable instance and restored on return,
 *      independent of the overlay stack and of route matching. Keyed by
 *      the resolved path (so it's naturally per-*instance*, e.g. Thread A
 *      and Thread B each keep their own position, not just "Thread" as a
 *      screen type).
 * *   3. Scroll restoration is DELIBERATELY NOT here — see
 *      lib/workContext.jsx's useScrollMemory, an already-existing, already
 *      TTL'd key→value store used for exactly this. Extended there (one new
 *      hook) instead of building a second, parallel scroll-memory system
 *      in this file.
 *
 * Any future section (Announcements, Rooms, ...) that needs deep links
 * just adds entries to ROUTES and uses the hooks below — nothing here is
 * Post/Tools/Stats-specific.
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

// ─── 1. Routes ────────────────────────────────────────────────────────────
// Add new instances here. `parent` is another route's `id` — used to know
// what "go up one level" means, independent of browser history contents.
export const ROUTES = [
  { id: "home",            path: "/",                          parent: null },
  { id: "profile",         path: "/profile",                   parent: "home" },
  { id: "postFeed",        path: "/post",                       parent: "profile" },
  { id: "thread",          path: "/post/:threadId",             parent: "postFeed" },
  { id: "subtema",         path: "/post/:threadId/:subtemaId",  parent: "thread" },
  { id: "announcements",   path: "/announcements",              parent: "profile" },
  { id: "stats",           path: "/stats",                      parent: "profile" },
  { id: "statsDashboard",  path: "/stats/dashboard",            parent: "stats" },
  { id: "tools",           path: "/tools",                      parent: "profile" },
  { id: "tool",            path: "/tools/:toolId",              parent: "tools" },
  { id: "rooms",           path: "/rooms",                      parent: "profile" },
];

function compile(route) {
  const paramNames = [];
  const regex = new RegExp("^" + route.path.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return "([^/]+)";
  }) + "/?$");
  return { ...route, regex, paramNames };
}
// Longest (most segments) first, so a more specific pattern like
// /post/:threadId/:subtemaId is tried before /post/:threadId for a URL
// that actually has both segments.
const COMPILED = [...ROUTES].sort((a, b) => b.path.split("/").length - a.path.split("/").length).map(compile);

export function matchRoute(pathname) {
  const path = pathname || "/";
  for (const r of COMPILED) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { routeId: r.id, params };
    }
  }
  return { routeId: "home", params: {} };
}

export function buildRoutePath(routeId, params = {}) {
  const r = ROUTES.find(x => x.id === routeId);
  if (!r) return "/";
  return r.path.replace(/:([^/]+)/g, (_, name) => encodeURIComponent(params[name] ?? ""));
}

function getRoute(routeId) { return ROUTES.find(x => x.id === routeId) || null; }

// ─── Section ↔ route mapping ──────────────────────────────────────────────
// App.jsx's tab bar deals in "section ids" (recaps/announcements/stats/
// tools/rooms, or null for the Perfil tab) — these two small maps are the
// only place that translates between that and the route table above, so
// App.jsx's existing section-switching UI can keep using the vocabulary it
// already has while still going through the one real navigate()/goBack().
export function sectionIdToRouteId(sectionId) {
  if (sectionId === "recaps") return "postFeed";
  if (sectionId === "announcements") return "announcements";
  if (sectionId === "stats") return "stats";
  if (sectionId === "tools") return "tools";
  if (sectionId === "rooms") return "rooms";
  return "profile"; // null = Perfil tab
}

export function routeIdToSectionId(routeId) {
  if (routeId === "postFeed" || routeId === "thread" || routeId === "subtema") return "recaps";
  if (routeId === "announcements") return "announcements";
  if (routeId === "stats" || routeId === "statsDashboard") return "stats";
  if (routeId === "tools" || routeId === "tool") return "tools";
  if (routeId === "rooms") return "rooms";
  return null; // "home" / "profile" → Perfil tab
}

/** The parent instance's {routeId, params} for a given route+params — only
 *  keeps the params the parent's own path template actually needs, e.g.
 *  subtema's parent (thread) keeps threadId but drops subtemaId. */
export function getParentInstance(routeId, params) {
  const r = getRoute(routeId);
  if (!r || !r.parent) return null;
  const parent = getRoute(r.parent);
  const parentParamNames = (parent.path.match(/:[^/]+/g) || []).map(s => s.slice(1));
  const parentParams = {};
  parentParamNames.forEach(name => { parentParams[name] = params[name]; });
  return { routeId: parent.id, params: parentParams };
}

// ─── 2 & 3. Provider ──────────────────────────────────────────────────────
const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [route, setRoute] = useState(() => matchRoute(window.location.pathname));
  // { id, onBack: () => "close"|"stay" }[] — top = last. A ref, not state:
  // this stack changes on every overlay open/close, far more often than
  // anything needs to re-render off of it directly (consumers read route,
  // not the stack).
  const overlayStackRef = useRef([]);
  // Set right before a *programmatic* history.back() used purely to
  // consume/discard a guard entry (see dismissOverlay) — the resulting
  // popstate is bookkeeping, not a real back-press, and must be ignored by
  // the handler below or it would double-process the dismissal.
  const ignoreNextPopStateRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      if (ignoreNextPopStateRef.current) {
        ignoreNextPopStateRef.current = false;
        return;
      }
      const stack = overlayStackRef.current;
      if (stack.length > 0) {
        const top = stack.pop();
        const result = top.onBack();
        if (result === "stay") {
          // The overlay decided not to actually close (e.g. showing an
          // "¿Descartar cambios?" confirmation) — its guard entry was just
          // consumed by this very popstate, so re-push a fresh one or the
          // NEXT back press would incorrectly skip straight past it to
          // whatever's now on top of the (one-shorter) stack.
          stack.push(top);
          window.history.pushState({ overlayGuard: top.id }, "", window.location.pathname);
        }
        return; // never falls through to route re-matching in the same press
      }
      setRoute(matchRoute(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Navigate to a real, new instance — pushes history, becomes the new
  // canonical URL. Only for actual page/instance transitions (Feed→Thread,
  // Thread→Subtema, Tools→Tool, Stats→Dashboard) — never for overlays
  // (composers/sheets/the fullscreen viewer use pushOverlay instead) and
  // never for a Thread's own internal scroll between its Updates/Subtemas,
  // which isn't navigation at all.
  const navigate = useCallback((routeId, params = {}) => {
    const path = buildRoutePath(routeId, params);
    if (path !== window.location.pathname) window.history.pushState(null, "", path);
    setRoute({ routeId, params });
  }, []);

  // Same instance, corrected/normalized URL — no new history entry. Used
  // for things like resolving an owner thread for a deep link, never for a
  // genuine hierarchy change (that's always navigate()).
  const replace = useCallback((routeId, params = {}) => {
    const path = buildRoutePath(routeId, params);
    if (path !== window.location.pathname) window.history.replaceState(null, "", path);
    setRoute({ routeId, params });
  }, []);

  // THE single back entry point for the whole app. Both the physical
  // back button (via the popstate listener above) and every in-app back
  // arrow / X / Cancel button call this — never window.history.back()
  // directly from a component. Simply simulates a back-press; the popstate
  // listener above is the one place that actually decides what happens
  // (overlay stack first, else real navigation) — that's what guarantees a
  // UI button and the hardware button can never disagree.
  const goBack = useCallback(() => { window.history.back(); }, []);

  // Registers an overlay (composer/sheet/fullscreen viewer) as owning the
  // next back-press. Returns nothing — the overlay identifies itself by
  // `id` for dismissOverlay. `onBack` must return "close" (this back press
  // fully dismisses it) or "stay" (consumed, but the overlay remains open —
  // e.g. it just switched to showing a confirmation).
  const pushOverlay = useCallback((id, onBack) => {
    overlayStackRef.current.push({ id, onBack });
    window.history.pushState({ overlayGuard: id }, "", window.location.pathname);
  }, []);

  // Explicit, non-back-triggered dismissal (a Save/Cancel/X button, or a
  // composer finishing its submit). Must be the CURRENT top of the stack —
  // overlays are only ever meant to close top-down, same order they
  // opened, so a nested fullscreen viewer over a composer always closes
  // before the composer can. Consumes its own guard entry via a
  // history.back() flagged to be ignored by the popstate handler, so it
  // doesn't ALSO re-trigger this same overlay's onBack.
  const dismissOverlay = useCallback((id) => {
    const stack = overlayStackRef.current;
    const top = stack[stack.length - 1];
    if (!top || top.id !== id) {
      console.warn(`[navigation] dismissOverlay("${id}") called but it isn't the top of the stack — ignoring. This usually means something above it needs to close first.`);
      return;
    }
    stack.pop();
    ignoreNextPopStateRef.current = true;
    window.history.back();
  }, []);

  const value = { route, navigate, replace, goBack, pushOverlay, dismissOverlay };
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation() must be used inside <NavigationProvider>");
  return ctx;
}

/**
 * useOverlayBack(active, onBack)
 *
 * The hook composers/sheets/the fullscreen viewer actually use — a thin,
 * safe wrapper around pushOverlay/dismissOverlay that handles registering
 * only once per "open", cleaning up if the component unmounts without an
 * explicit close (belt and suspenders), and gives back a stable `close()`
 * to wire to X/Cancel buttons.
 *
 * active: whether this overlay is currently open. Toggling true→false from
 *   OUTSIDE (i.e. not via close()) is treated the same as calling close().
 * onBack(): () => "close" | "stay" — same contract as pushOverlay.
 *
 * Returns `close()` — call this from any in-app dismiss button instead of
 * touching state directly, so it goes through the exact same path physical
 * back does.
 */
export function useOverlayBack(active, onBack) {
  const { pushOverlay, dismissOverlay } = useNavigation();
  const idRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    const id = `overlay-${Math.random().toString(36).slice(2)}`;
    idRef.current = id;
    pushOverlay(id, () => {
      const result = onBackRef.current();
      // The provider already popped this overlay off the stack before
      // calling onBack — if it decided "close", that's final, so forget
      // the id now. Otherwise the cleanup below (which fires when `active`
      // flips false, e.g. right after this same close) would try to
      // dismiss an id that's already gone, hitting dismissOverlay's
      // "not the top of the stack" guard against whatever opened next.
      if (result === "close") idRef.current = null;
      return result;
    });
    return () => {
      // Unmounted/deactivated without going through close() (e.g. the
      // parent conditionally stopped rendering it another way) — still
      // needs its guard entry cleaned up so history doesn't accumulate
      // orphaned entries. No-ops if onBack already consumed it above.
      if (idRef.current === id) { dismissOverlay(id); idRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const close = useCallback(() => {
    if (idRef.current) { dismissOverlay(idRef.current); idRef.current = null; }
  }, [dismissOverlay]);

  return close;
}
