/**
 * internalUrls.js
 *
 * ONE place to turn a route + params into a full, shareable URL — reused by
 * anything that needs a real link to a Post/Subtema/etc: initially just the
 * Registrar → Doers Link field, later Share Sheet and anything else that
 * needs the same kind of URL.
 *
 * Deliberately built ON TOP of navigation.jsx's own `buildRoutePath` (which
 * already turns a routeId + params into a path using the real ROUTES
 * table) rather than duplicating any route-template logic here — this file
 * only adds the "make it a full URL" step buildRoutePath itself doesn't do
 * (it returns a path, not an absolute URL), plus the small
 * postId/subtemaId-shaped convenience wrappers.
 *
 * No hardcoded domain anywhere: window.location.origin is read at call
 * time, every time — if the app is ever served from a different domain
 * (xplannation.com instead of plantion.vercel.app), every URL this file
 * produces adapts automatically with zero code changes here or at any call
 * site.
 */
import { buildRoutePath } from "./navigation.jsx";

/**
 * Generic building block — an absolute URL for any existing route id +
 * params, e.g. getInternalUrl("thread", { threadId }). Exported (not just
 * used internally) so a future need for a route this file doesn't have a
 * named wrapper for yet doesn't require adding one just to get a URL.
 */
export function getInternalUrl(routeId, params = {}) {
  return `${window.location.origin}${buildRoutePath(routeId, params)}`;
}

/** Absolute URL for a Post — /post/:threadId. */
export function getPostUrl(postId) {
  return getInternalUrl("thread", { threadId: postId });
}

/**
 * Absolute URL for a Subtema — /post/:threadId/:subtemaId. Not consumed by
 * anything yet (Registrar is Post-only per current product decision — see
 * Post.jsx), kept here ready for whenever Subtema needs one of its own
 * (sharing, or its own Registrar-equivalent later) without another round
 * of "where does URL-building logic live".
 */
export function getSubtemaUrl(postId, subtemaId) {
  return getInternalUrl("subtema", { threadId: postId, subtemaId });
}
