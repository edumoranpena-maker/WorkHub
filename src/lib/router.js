/**
 * router.js
 *
 * Deep-linking core for PlanSpace — pure functions only, zero React, zero
 * state of its own. This module never becomes a second source of truth: it
 * only translates between a URL string and a plain "intent" object in both
 * directions. App.jsx/RootShell own every actual piece of state; they call
 * parseRoute() when a URL needs to become state (initial load, browser
 * back/forward) and buildPath() when state needs to become a URL (the user
 * navigated in-app). Neither function reads or writes anything outside its
 * own arguments.
 *
 * Adding a new route — a new tool, a new content type — means adding one
 * entry to ROUTES (parse direction) and one branch to buildPath (build
 * direction). Nothing else in the app changes shape.
 *
 * Scope note: only the routes PlanSpace actually asked for exist here.
 * Recaps and Announcements have no bare "tab" URL (only their individual
 * items — /post/:id, /thread/:id, /announcement/:id — do), because none was
 * requested; buildPath() returns null for a state that has no defined
 * canonical URL, and the caller is expected to simply leave the current URL
 * alone in that case rather than invent one. Rooms has no /room/:id yet
 * because there's no individual Room view to open — only the plain /rooms
 * tab route exists until that view is built.
 *
 * ── History depth: making the UI's back arrow and the OS Back button truly
 * equivalent ──────────────────────────────────────────────────────────────
 * A URL string alone can't tell a "close" action two things it needs to
 * know: (1) is there really a history entry behind this one that PlanSpace
 * itself pushed, or did the user land directly on this URL (a shared deep
 * link, a fresh reload) with nothing of ours behind it? and (2) for content
 * nested a level deeper than any URL exists for — a Subtema open inside a
 * Thread has no route of its own, by the scope note above — which of two
 * entries sharing the exact same URL are we actually on?
 *
 * Both are answered by tagging every entry PlanSpace pushes with a `depth`
 * (and, where the URL alone is ambiguous, a small amount of extra state)
 * inside the history entry's own state object — not in React state, not in
 * the URL, in the one place the browser itself persists and restores it
 * automatically across every back/forward/reload: `history.state`.
 * pushRoute()/replaceRoute() are the only two places that ever write it;
 * currentDepth() and closeToParent() are the only two that ever read it to
 * make a decision. A Subtema's pushRoute() call reuses its Thread's own URL
 * untouched (no shareable /subtema/:id was ever wanted) but still gets a
 * genuinely distinct, poppable entry — pushState always creates a new entry
 * even when the URL string doesn't change.
 */

// ─── Route table (URL → intent) ─────────────────────────────────────────────
// Order matters only in that more specific patterns should come before more
// general ones sharing a prefix (e.g. "/tools/:id" before a hypothetical
// bare "/tools" would be wrong the other way round) — every pattern here is
// unambiguous regardless, but new entries should keep that in mind.
const ROUTES = [
  { id: "profile",      pattern: /^\/profile\/([^/]+)\/?$/,        toIntent: (m) => ({ type: "profile", username: decodeURIComponent(m[1]) }) },
  { id: "post",         pattern: /^\/post\/([^/]+)\/?$/,           toIntent: (m) => ({ type: "post", postId: decodeURIComponent(m[1]) }) },
  { id: "thread",       pattern: /^\/thread\/([^/]+)\/?$/,         toIntent: (m) => ({ type: "thread", threadId: decodeURIComponent(m[1]) }) },
  { id: "update",       pattern: /^\/update\/([^/]+)\/?$/,         toIntent: (m) => ({ type: "update", updateId: decodeURIComponent(m[1]) }) },
  { id: "announcement", pattern: /^\/announcement\/([^/]+)\/?$/,   toIntent: (m) => ({ type: "announcement", announcementId: decodeURIComponent(m[1]) }) },
  { id: "stats",        pattern: /^\/stats\/?$/,                  toIntent: () => ({ type: "stats" }) },
  { id: "rooms",        pattern: /^\/rooms\/?$/,                  toIntent: () => ({ type: "rooms" }) },
  { id: "tool",         pattern: /^\/tools\/([^/]+)\/?$/,          toIntent: (m) => ({ type: "tool", toolId: decodeURIComponent(m[1]) }) },
  { id: "tools",        pattern: /^\/tools\/?$/,                  toIntent: () => ({ type: "tools" }) },
];

/**
 * URL (+ optional history-entry state, for the one case the URL alone can't
 * express) → intent. Always returns a plain object with a `type`; falls
 * back to `{ type: "home" }` for "/" itself and for any path that doesn't
 * match a known route, rather than leaving the app on a blank screen for a
 * typo'd or stale URL.
 *
 * `historyState` is read only to upgrade a "thread" intent into a
 * "subtema-in-thread" intent when the entry we're actually on says a
 * subtema was open — everything else about it (depth, etc.) is the
 * caller's concern, not parseRoute's.
 */
export function parseRoute(pathname, historyState) {
  const path = pathname || "/";
  let base = { type: "home" };
  if (path !== "/") {
    base = { type: "home" };
    for (const route of ROUTES) {
      const m = path.match(route.pattern);
      if (m) { base = route.toIntent(m); break; }
    }
  }
  if (base.type === "thread" && historyState?.subtemaId && historyState?.threadId === base.threadId) {
    return { type: "subtema-in-thread", threadId: base.threadId, subtemaId: historyState.subtemaId };
  }
  return base;
}

/**
 * App state snapshot → canonical URL, or null if this exact state has no
 * defined route (see the scope note above — the caller should leave the
 * URL untouched when this returns null, not clear it or guess one).
 *
 * `snapshot` fields (all optional, read defensively — callers only fill in
 * what's relevant to where the user currently is):
 *   activeSectionId    — "recaps" | "announcements" | "stats" | "rooms" | "tools" | null (null = Perfil tab)
 *   username           — for the Perfil tab's own URL
 *   currentThreadId    — a Thread's own id, if one is open in Recaps
 *   currentToolId      — a Tool's id, if one is open in Tools
 *   currentAnnouncementId — a story or announcement-post id, if one is open
 *
 * Deliberately does NOT take a subtema id — a Subtema never changes the
 * URL (see the file header), so it has nothing to contribute here. Its
 * entry is pushed directly via pushRoute() with the Thread's own path.
 */
export function buildPath(snapshot) {
  const {
    activeSectionId = null,
    username = "",
    currentThreadId = null,
    currentToolId = null,
    currentAnnouncementId = null,
  } = snapshot || {};

  if (activeSectionId === "recaps" && currentThreadId) {
    return `/thread/${encodeURIComponent(currentThreadId)}`;
  }
  if (activeSectionId === "announcements" && currentAnnouncementId) {
    return `/announcement/${encodeURIComponent(currentAnnouncementId)}`;
  }
  if (activeSectionId === "tools" && currentToolId) {
    return `/tools/${encodeURIComponent(currentToolId)}`;
  }
  switch (activeSectionId) {
    case null:     return `/profile/${encodeURIComponent(username || "me")}`;
    case "stats":  return "/stats";
    case "rooms":  return "/rooms";
    case "tools":  return "/tools";
    default:       return null; // e.g. "recaps"/"announcements" with nothing open — no bare route requested
  }
}

// ─── History depth ──────────────────────────────────────────────────────────
// `historyImpl` defaults to the real browser `window.history`/`window`, and
// is overridable purely so a test can inject a fake one — production code
// never passes it.
function historyOf(historyImpl) { return historyImpl || (typeof window !== "undefined" ? window.history : null); }

/** The depth tag on the entry we're currently sitting on, or 0 if this
 *  entry was never tagged (the very first load of the session). */
export function currentDepth(historyImpl) {
  const h = historyOf(historyImpl);
  return h?.state?.depth ?? 0;
}

/** Call once at startup. Annotates whatever entry the browser actually
 *  loaded with depth 0 — via replaceState, so it never creates a new entry
 *  or changes the URL — but only if it isn't already tagged (a reload of a
 *  page we ourselves navigated to keeps its real depth, it doesn't reset
 *  to 0). `currentPath` is passed in explicitly (rather than this function
 *  reaching for the global `window.location` itself) purely so this stays
 *  testable against a fake browser — production call sites just pass
 *  `window.location.pathname + window.location.search`. */
export function tagInitialEntry(currentPath, historyImpl) {
  const h = historyOf(historyImpl);
  if (!h) return;
  if (h.state?.depth == null) {
    h.replaceState({ ...(h.state || {}), depth: 0 }, "", currentPath);
  }
}

/** Pushes a new, genuinely distinct history entry one level deeper than
 *  whatever we're currently on — `extra` merges into the entry's state
 *  (e.g. { subtemaId } for the Subtema-in-Thread case), never into the URL. */
export function pushRoute(path, extra, historyImpl) {
  const h = historyOf(historyImpl);
  if (!h) return;
  const depth = currentDepth(historyImpl) + 1;
  h.pushState({ depth, ...extra }, "", path);
}

/** Corrects the current entry in place — same depth, no new entry, no
 *  entry consumed. Used for tab switches and other lateral moves that were
 *  never meant to be a back-button stop, and as closeToParent()'s fallback
 *  when there's genuinely nothing of ours to go back to. */
export function replaceRoute(path, extra, historyImpl) {
  const h = historyOf(historyImpl);
  if (!h) return;
  const depth = currentDepth(historyImpl);
  h.replaceState({ depth, ...extra }, "", path);
}

/**
 * The one function every "close this portal" action in the app should call
 * — never onClose-style handlers reaching for replaceState or their own
 * local state directly. If there's a real entry behind this one that
 * PlanSpace itself pushed (depth > 0), goes there via true back navigation
 * — history.back() — so the resulting popstate is indistinguishable from
 * the user having pressed the OS/device Back button; closing via the UI's
 * X and closing via the hardware button become the exact same action from
 * this point on. Only falls back to replaceRoute (correcting in place,
 * consuming no entry) when depth is 0 — meaning this portal was the entry
 * point of the session itself (a shared deep link, a hard reload) and
 * there is nothing of ours left to go back to; back() there would either
 * do nothing or leave the app entirely, which is worse than a same-entry
 * correction.
 */
export function closeToParent(fallbackPath, fallbackExtra, historyImpl) {
  const h = historyOf(historyImpl);
  if (!h) return "none";
  if (currentDepth(historyImpl) > 0) {
    h.back();
    return "back";
  }
  replaceRoute(fallbackPath, fallbackExtra, historyImpl);
  return "replace";
}
