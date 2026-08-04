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
 * URL → intent. Always returns a plain object with a `type`; falls back to
 * `{ type: "home" }` for "/" itself and for any path that doesn't match a
 * known route, rather than leaving the app on a blank screen for a typo'd
 * or stale URL.
 */
export function parseRoute(pathname) {
  const path = pathname || "/";
  if (path === "/") return { type: "home" };
  for (const route of ROUTES) {
    const m = path.match(route.pattern);
    if (m) return route.toIntent(m);
  }
  return { type: "home" };
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
