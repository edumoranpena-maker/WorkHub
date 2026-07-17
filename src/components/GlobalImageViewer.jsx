/**
 * GlobalImageViewer.jsx  — v3
 *
 * Fullscreen gallery viewer with:
 *  - Multi-item navigation (swipe/drag horizontal via Pointer Events — works
 *    with touch AND mouse, so it's also testable on desktop) / prev/next
 *  - Pinch-to-zoom + pan on images (zoom > 1 locks horizontal nav)
 *  - Renders image, video, link-preview and generic-file items — matches
 *    whatever mix MediaCarousel passed in, in the original order
 *  - Temporary position indicator ("2 / 5") that fades in/out
 *  - Viewport zoom lock while open (prevents accidental UI zoom)
 *  - All swipe events blocked from bubbling to App's swipe-navigation
 *
 * API:
 *   const { openGallery, ViewerPortal } = useImageViewer();
 *   openGallery({ items: [{type, url, thumb?}], startIndex: 2 })
 *   // single image shorthand still works:
 *   openGallery({ items: [{ type:"image", url }], startIndex: 0 })
 *
 * ExpandImageButton is kept for backward compat but MediaCarousel now
 * calls openGallery with the full items array, so every image opens
 * the full gallery at the right position.
 *
 * NOT used by Stories.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { X, File as FileIcon, ExternalLink, Download } from "lucide-react";
import { getVisibilityOption } from "../lib/visibility.jsx";

// ── Constants ────────────────────────────────────────────────────────────────
const SWIPE_MIN       = 50;   // px to count as a swipe between items
const SWIPE_RATIO     = 1.4;  // horiz must be N× vertical to be counted
const LOCK_PX         = 8;    // direction lock threshold
const INDICATOR_SHOW  = 5200; // ms the position indicator (and info blocks) stay visible — was 2200, +3000 per request
const MAX_ZOOM        = 5;
const MIN_ZOOM        = 1;
const DOUBLE_TAP_MS   = 280;  // ms window for double-tap-to-zoom
const DESCRIPTION_COLLAPSE_LEN = 120; // chars — beyond this, description collapses to 2 lines + "Ver más"
const DESCRIPTION_MAX_HEIGHT = "38vh"; // cap once expanded — beyond this, internal scroll takes over

// Relative-time label ("Hace 2 horas") for the info panel's metadata line.
// Local to this file on purpose — GlobalImageViewer is a generic, reusable
// viewer (also used outside Post.jsx, e.g. HomeFeed.jsx), so it doesn't
// import Post.jsx's own (unexported, English-formatted) fmtDate.
function fmtRelativeEs(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "Justo ahora";
  if (diff < 3600) { const m = Math.floor(diff / 60); return `Hace ${m} min`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `Hace ${h} hora${h !== 1 ? "s" : ""}`; }
  if (diff < 172800) return "Ayer";
  const days = Math.floor(diff / 86400);
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ── Viewport zoom lock ────────────────────────────────────────────────────────
// Swap the viewport meta tag to prevent the browser from pinch-zooming the
// app shell while the viewer is open. Restored when viewer closes.
function lockViewportZoom() {
  let meta = document.querySelector("meta[name=viewport]");
  if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
  meta.dataset.prev = meta.content;
  meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
}
function unlockViewportZoom() {
  const meta = document.querySelector("meta[name=viewport]");
  if (meta && meta.dataset.prev !== undefined) meta.content = meta.dataset.prev;
}

// ── Position indicator ────────────────────────────────────────────────────────
function PositionIndicator({ current, total, visible }) {
  if (total <= 1) return null;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
            borderRadius: 99, padding: "4px 14px", pointerEvents: "none", zIndex: 10,
          }}
        >
          <span style={{ fontFamily: "sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "0.04em" }}>
            {current + 1} / {total}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Media info header — author, content type, metadata ──────────────────────
// Top block: stays exactly where the combined panel used to sit. Reusable
// across Post/Update/Subtema via the same `context` shape ({ author,
// contentType, timestamp, visibility, edited, description }) — description
// itself now lives in MediaDescriptionBlock below, not here. Purely
// presentational: no local state, so nothing to reset between items.
function MediaInfoHeader({ context, visible }) {
  if (!context) return null;
  const { author, contentType, timestamp, visibility, edited } = context;
  const metaParts = [fmtRelativeEs(timestamp), visibility ? getVisibilityOption(visibility).label : null, edited ? "Editado" : null].filter(Boolean);
  if (!author && metaParts.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          style={{
            position: "absolute", top: 46, left: 18, right: 18, zIndex: 10,
            display: "flex", flexDirection: "column", gap: 4,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
            borderRadius: 14, padding: "8px 12px",
            width: "fit-content", maxWidth: "calc(100% - 36px)",
            pointerEvents: "none", // purely informational — never intercepts taps
          }}
        >
          {/* Author row — avatar, name, content type (lesser hierarchy) inline */}
          {author && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                  {author[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff",
                textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {author}
                {contentType && <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.7)" }}> · {contentType}</span>}
              </span>
            </div>
          )}

          {/* Metadata line */}
          {metaParts.length > 0 && (
            <div style={{
              paddingLeft: author ? 30 : 0,
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
              color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.7)",
            }}>
              {metaParts.join(" • ")}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Media description block — bottom-anchored, Telegram-style ───────────────
// Independent from the header above: its own gradient backdrop (grows with
// the text, capped at DESCRIPTION_MAX_HEIGHT with internal scroll beyond
// that). The whole zone is tappable: a tap anywhere in it expands (same as
// "Ver más"); once expanded, a tap inside does nothing — only "Ver menos"
// collapses it. Every tap here (collapsed or expanded) stops propagation, so
// it never reaches the backdrop's tap-to-toggle-chrome handler — that's what
// keeps a tap on the text from accidentally hiding the whole viewer instead
// of expanding it. Internal scroll (once expanded, past the max height) is
// the only other gesture this component intercepts.
function MediaDescriptionBlock({ description, visible, expanded, onExpandChange }) {
  const desc = (description || "").trim();
  if (!desc) return null;
  const isLong = desc.length > DESCRIPTION_COLLAPSE_LEN;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10,
            paddingTop: 44, // gradient fade-in room above the text
            background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.62) 55%, transparent 100%)",
            pointerEvents: "none", // decorative wrapper — never intercepts anything itself
          }}
        >
          <div
            style={{
              pointerEvents: "auto", // whole zone is now interactive — see onClick below
              padding: `14px 18px max(14px, env(safe-area-inset-bottom))`,
              maxHeight: expanded ? DESCRIPTION_MAX_HEIGHT : "none",
              overflowY: expanded ? "auto" : "visible",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Any tap in the zone expands it, exactly like "Ver más" — but
              // only ever expands here; collapsing is the button's job alone.
              if (!expanded && isLong) onExpandChange(true);
            }}
            // Only intercepts touch (for internal scroll) once expanded —
            // collapsed, a swipe starting over the 2-line preview still
            // reaches the backdrop exactly as it always did.
            onTouchStart={expanded ? (e) => e.stopPropagation() : undefined}
            onTouchMove={expanded ? (e) => e.stopPropagation() : undefined}
            onTouchEnd={expanded ? (e) => e.stopPropagation() : undefined}
          >
            <p style={{
              margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.5,
              color: "rgba(255,255,255,0.94)", whiteSpace: "pre-wrap",
              display: (!expanded && isLong) ? "-webkit-box" : "block",
              WebkitLineClamp: (!expanded && isLong) ? 2 : undefined,
              WebkitBoxOrient: (!expanded && isLong) ? "vertical" : undefined,
              overflow: (!expanded && isLong) ? "hidden" : "visible",
            }}>
              {desc}
            </p>
            {isLong && (
              <button
                onClick={(e) => { e.stopPropagation(); onExpandChange(!expanded); }}
                style={{
                  marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: "#fff",
                  pointerEvents: "auto",
                }}
              >
                {expanded ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


function LinkPane({ item }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, maxWidth: "88vw" }}>
      {(item.thumb || item.url) && (
        <img
          src={item.thumb || item.url}
          alt=""
          draggable={false}
          style={{ maxWidth: "88vw", maxHeight: "62vh", width: "auto", height: "auto", objectFit: "contain", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", userSelect: "none" }}
        />
      )}
      <div style={{ textAlign: "center", padding: "0 16px" }}>
        <p style={{ margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>{item.title || "Enlace"}</p>
        <a
          href={item.linkUrl || item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 99, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          <ExternalLink size={14} /> Abrir enlace
        </a>
      </div>
    </div>
  );
}

// ── File pane — shown when the viewer swipes to a generic-file item ───────────
function FilePane({ item }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "0 24px" }}>
      <div style={{ width: 96, height: 96, borderRadius: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <FileIcon size={38} color="#fff" strokeWidth={1.4} />
      </div>
      <p style={{ margin: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", maxWidth: "80vw", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name || "Archivo"}
      </p>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        download={item.name || undefined}
        onClick={e => e.stopPropagation()}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 99, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
      >
        <Download size={14} /> Abrir archivo
      </a>
    </div>
  );
}

// ── Single image pane with zoom+pan ──────────────────────────────────────────
function ZoomableImage({ src, onZoomChange }) {
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gestureRef = useRef(null);  // tracks active gesture state
  const lastTapRef = useRef(0);

  // Notify parent of zoom level so it can gate swipe navigation
  useEffect(() => { onZoomChange?.(scale); }, [scale]);

  const clampOffset = (ox, oy, sc, w, h) => {
    const maxX = Math.max(0, (w * sc - w) / 2);
    const maxY = Math.max(0, (h * sc - h) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // detect double-tap-to-zoom
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        e.stopPropagation();
        if (scale > 1) { reset(); }
        else { setScale(2.5); }
        lastTapRef.current = 0;
        gestureRef.current = null;
        return;
      }
      lastTapRef.current = now;
      gestureRef.current = {
        type: "pan",
        startX: e.touches[0].clientX - offset.x,
        startY: e.touches[0].clientY - offset.y,
      };
      // Only claim this gesture if we're actually zoomed in (panning).
      // At scale=1 let it bubble up — the backdrop needs it to drive swipe-to-navigate.
      if (scale > 1.05) e.stopPropagation();
    } else if (e.touches.length === 2) {
      e.stopPropagation(); // pinch always claims the gesture
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      gestureRef.current = {
        type: "pinch",
        startDist: Math.hypot(dx, dy),
        startScale: scale,
        startOffset: { ...offset },
        midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e) => {
    const g = gestureRef.current;
    if (!g) return;
    if (g.type === "pan" && scale > 1) {
      e.stopPropagation();
      const el = e.currentTarget;
      const ox = e.touches[0].clientX - g.startX;
      const oy = e.touches[0].clientY - g.startY;
      setOffset(clampOffset(ox, oy, scale, el.offsetWidth, el.offsetHeight));
    } else if (g.type === "pinch" && e.touches.length === 2) {
      e.stopPropagation();
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.startScale * (dist / g.startDist)));
      setScale(newScale);
      if (newScale <= 1) setOffset({ x: 0, y: 0 });
    }
    // else: single-finger touch at scale=1 — don't stop propagation,
    // let the backdrop track it for horizontal swipe-to-navigate.
  };

  const handleTouchEnd = (e) => {
    if (scale > 1.05 || gestureRef.current?.type === "pinch") e.stopPropagation();
    if (scale < 1.05) reset();
    gestureRef.current = null;
  };

  return (
    <div
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          maxWidth: "94vw", maxHeight: "90vh",
          width: "auto", height: "auto",
          objectFit: "contain", borderRadius: 8,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transformOrigin: "center center",
          transition: scale === 1 ? "transform 0.22s ease" : "none",
          userSelect: "none", touchAction: "none",
        }}
      />
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────────────────────────
function GlobalImageViewer({ items, startIndex, context, groups, onClose }) {
  const [idx, setIdx]           = useState(startIndex ?? 0);
  const [dir, setDir]           = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [indicatorVisible, setIndicatorVisible] = useState(true);
  // Which content's description is expanded, if any — not a plain boolean.
  // Expansion belongs to a specific Post/Update/Subtema, not to a media
  // index: swiping to the next photo of the SAME content keeps it expanded;
  // crossing into a different content always resets it (handled by the
  // group-change effect below).
  const [expandedContentId, setExpandedContentId] = useState(null);
  const indicatorTimer          = useRef(null);
  const touchRef                = useRef(null);
  const mouseRef                = useRef(null);
  const didDragRef              = useRef(false);
  const count                   = items.length;
  const current                 = items[idx] ?? items[0];

  // Groups describe the fullscreen journey as segments of `items`, each with
  // its own info-panel context — e.g. Post's 3 photos, then Update 1's 2
  // photos, then Subtema's 1 photo, all in the same flat `items` array. When
  // the caller doesn't pass any (single-content callers like HomeFeed.jsx),
  // everything falls into one synthetic group wrapping the plain `context`
  // prop — same behavior as before groups existed.
  const resolvedGroups = useMemo(
    () => (groups && groups.length ? groups : [{ contentId: "__single__", context, count: items.length, startIdx: 0 }]),
    [groups, context, items.length]
  );
  const currentGroupIdx = useMemo(() => {
    for (let g = 0; g < resolvedGroups.length; g++) {
      const grp = resolvedGroups[g];
      if (idx >= grp.startIdx && idx < grp.startIdx + grp.count) return g;
    }
    return 0;
  }, [idx, resolvedGroups]);
  const currentGroup = resolvedGroups[currentGroupIdx];
  const localIdx = idx - currentGroup.startIdx;
  const expanded = expandedContentId !== null && expandedContentId === currentGroup.contentId;

  // Lock viewport zoom while viewer is open
  useEffect(() => {
    lockViewportZoom();
    return () => unlockViewportZoom();
  }, []);

  // Auto-hide indicator. Skips re-arming the countdown while the CURRENT
  // content's description is held open — reading time shouldn't be cut off
  // by a timer, and re-showing the chrome after a "clean mode" tap (below)
  // shouldn't silently restart a countdown either.
  const showIndicator = useCallback(() => {
    setIndicatorVisible(true);
    clearTimeout(indicatorTimer.current);
    if (expandedContentId !== null && expandedContentId === currentGroup.contentId) return;
    indicatorTimer.current = setTimeout(() => setIndicatorVisible(false), INDICATOR_SHOW);
  }, [expandedContentId, currentGroup]);

  useEffect(() => {
    showIndicator();
    return () => clearTimeout(indicatorTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Reset the expanded description only when the CONTENT changes — not on
  // every media index change. Swiping within the same Post/Update/Subtema's
  // own photos must not collapse it.
  useEffect(() => {
    setExpandedContentId(null);
  }, [currentGroupIdx]);

  // Expanding holds the chrome (header + description) open indefinitely for
  // its own content — no auto-hide while the user is reading (see
  // showIndicator above). Collapsing resumes the normal auto-hide countdown
  // right away — force it directly rather than via showIndicator, since
  // expandedContentId hasn't actually committed to state yet at this point
  // in the same call, and would otherwise still read as "expanded".
  const handleDescExpandChange = useCallback((next) => {
    if (next) {
      setExpandedContentId(currentGroup.contentId);
      clearTimeout(indicatorTimer.current);
      setIndicatorVisible(true);
    } else {
      setExpandedContentId(null);
      setIndicatorVisible(true);
      clearTimeout(indicatorTimer.current);
      indicatorTimer.current = setTimeout(() => setIndicatorVisible(false), INDICATOR_SHOW);
    }
  }, [currentGroup]);

  const goTo = useCallback((next, direction) => {
    if (next < 0 || next >= count) return;
    setDir(direction);
    setIdx(next);
    setZoomScale(1);
  }, [count]);

  // Swipe between items — only when image is at scale 1
  const onTouchStart = (e) => {
    e.stopPropagation();
    if (zoomScale > 1.05) return; // let ZoomableImage handle panning
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null };
  };

  const onTouchMove = (e) => {
    e.stopPropagation();
    const s = touchRef.current;
    if (!s || zoomScale > 1.05) return;
    const dx = Math.abs(e.touches[0].clientX - s.x);
    const dy = Math.abs(e.touches[0].clientY - s.y);
    if (!s.locked && (dx > LOCK_PX || dy > LOCK_PX)) {
      s.locked = dx > dy * SWIPE_RATIO ? "h" : "v";
    }
  };

  const onTouchEnd = (e) => {
    e.stopPropagation();
    const s = touchRef.current;
    if (!s || zoomScale > 1.05) { touchRef.current = null; return; }
    if (s.locked === "h") {
      const dx = e.changedTouches[0].clientX - s.x;
      if (Math.abs(dx) >= SWIPE_MIN) {
        dx < 0 ? goTo(idx + 1, 1) : goTo(idx - 1, -1);
      }
    }
    touchRef.current = null;
  };

  // Backdrop click = close (only if not zoomed, and not the tail end of a mouse-drag swipe)
  const handleBackdropClick = () => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    if (zoomScale <= 1.05) onClose();
  };

  // Mouse drag — same swipe-between-items behaviour as touch, so the viewer
  // is also fully navigable with a mouse (desktop/preview testing).
  // Real touch keeps using onTouchStart/Move/End above, untouched.
  const onPointerDown = (e) => {
    e.stopPropagation();
    if (e.pointerType !== "mouse") return;
    if (zoomScale > 1.05) return;
    mouseRef.current = { x: e.clientX, y: e.clientY, locked: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    e.stopPropagation();
    if (e.pointerType !== "mouse") return;
    const s = mouseRef.current;
    if (!s || zoomScale > 1.05) return;
    const dx = Math.abs(e.clientX - s.x);
    const dy = Math.abs(e.clientY - s.y);
    if (!s.locked && (dx > LOCK_PX || dy > LOCK_PX)) {
      s.locked = dx > dy * SWIPE_RATIO ? "h" : "v";
    }
  };

  const onPointerUp = (e) => {
    e.stopPropagation();
    if (e.pointerType !== "mouse") return;
    const s = mouseRef.current;
    if (!s || zoomScale > 1.05) { mouseRef.current = null; return; }
    if (s.locked) didDragRef.current = true; // suppress the native click that follows a real drag
    if (s.locked === "h") {
      const dx = e.clientX - s.x;
      if (Math.abs(dx) >= SWIPE_MIN) {
        dx < 0 ? goTo(idx + 1, 1) : goTo(idx - 1, -1);
      }
    }
    mouseRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const variants = {
    enter:  (d) => ({ x: d >= 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d) => ({ x: d >= 0 ? "-100%" : "100%", opacity: 0 }),
  };

  if (!current) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="viewer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(0,0,0,0.95)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          touchAction: "none",
        }}
      >
        {/* Position indicator — local to the current content (e.g. "2/3" for
            the Post's own photos), not a global count across the whole
            Thread journey. */}
        <PositionIndicator current={localIdx} total={currentGroup.count} visible={indicatorVisible} />

        {/* Info header — Post/Update/Subtema context. Images and files only
            (never video or link — video gets its own viewer later, and link
            items already show their own title/CTA via LinkPane). Same spot
            it's always been; re-fed with whichever group is current, so it
            updates automatically as the journey crosses into the next
            content. No local state, nothing to reset per item. */}
        {(current.type === "image" || current.type === "file") && (
          <MediaInfoHeader context={currentGroup.context} visible={indicatorVisible} />
        )}

        {/* Sliding item frame */}
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={idx}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => {
              e.stopPropagation();
              // Tap on image toggles indicator visibility (only for images).
              // Taps landing here never originate from inside the description
              // zone — MediaDescriptionBlock stops propagation on every tap
              // of its own area — so reaching this handler always means
              // "outside the description". Hiding the chrome this way is a
              // temporary "clean mode": an expanded description stays
              // expanded underneath, and tapping again reveals both exactly
              // as they were. Only "Ver menos" or an actual content change
              // (see the group-change effect above) resets the expansion.
              if (current.type !== "video") {
                if (indicatorVisible) {
                  clearTimeout(indicatorTimer.current);
                  setIndicatorVisible(false);
                } else {
                  showIndicator();
                }
              }
            }}
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {current.type === "video" ? (
              <video
                src={current.url}
                controls
                playsInline
                autoPlay
                style={{
                  maxWidth: "94vw", maxHeight: "90vh",
                  width: "auto", height: "auto",
                  borderRadius: 8, boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                  touchAction: "none",
                }}
              />
            ) : current.type === "link" ? (
              <LinkPane item={current} />
            ) : current.type === "file" ? (
              <FilePane item={current} />
            ) : (
              <ZoomableImage
                src={current.url}
                onZoomChange={setZoomScale}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Info description — bottom-anchored, own gradient/scroll. Rendered
            after the item frame so it paints above it; its own pointer-events
            scoping (see component) keeps it from stealing gestures it doesn't
            need. Persists expansion across media of the SAME content — see
            expandedContentId above — and resets when the content changes. */}
        {(current.type === "image" || current.type === "file") && (
          <MediaDescriptionBlock
            description={currentGroup.context?.description}
            visible={indicatorVisible}
            expanded={expanded}
            onExpandChange={handleDescExpandChange}
          />
        )}


        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          style={{
            position: "fixed", top: "max(16px, env(safe-area-inset-top))", right: 16,
            width: 40, height: 40, borderRadius: "50%", zIndex: 3001,
            background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff",
          }}
        >
          <X size={20} strokeWidth={2.2} />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useImageViewer() {
  const [gallery, setGallery] = useState(null); // { items, startIndex, context, groups }

  /** Open the gallery at a specific index.
   *  openGallery({ items, startIndex }) for multi-item context
   *  openGallery({ items: [{ type:"image", url }], startIndex: 0 }) for single image
   *  openGallery({ items, startIndex, context }) — context is optional; when
   *  present it feeds the info panel (author/type/metadata/description) for
   *  image and file items. Callers that omit it (video-only carousels, the
   *  old single-image shorthand, etc.) behave exactly as before.
   *  openGallery({ items, startIndex, groups }) — groups is optional; when
   *  present, items spans MULTIPLE contents back-to-back (e.g. a whole
   *  Thread's Post + Updates + Subtemas) and groups describes each content's
   *  own segment + context, so the info panel and position indicator update
   *  automatically as the swipe crosses from one content into the next.
   *  Omit it and a single caller-supplied `context` applies to all items,
   *  exactly as before groups existed.
   */
  const openGallery = useCallback(({ items, startIndex = 0, context = null, groups = null }) => {
    if (items?.length) setGallery({ items, startIndex, context, groups });
  }, []);

  /** Backward-compat: openImage(url) still works for single images */
  const openImage = useCallback((url) => {
    if (url) setGallery({ items: [{ type: "image", url }], startIndex: 0, context: null, groups: null });
  }, []);

  const closeImage = useCallback(() => setGallery(null), []);

  const ViewerPortal = useCallback(
    () => gallery
      ? <GlobalImageViewer items={gallery.items} startIndex={gallery.startIndex} context={gallery.context} groups={gallery.groups} onClose={closeImage} />
      : null,
    [gallery, closeImage]
  );

  return { openGallery, openImage, closeImage, ViewerPortal };
}

// ── ExpandImageButton ────────────────────────────────────────────────────────
export function ExpandImageButton({ onClick, size = 26 }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label="Expand image"
      style={{
        position: "absolute", bottom: 8, right: 8,
        width: size, height: size, borderRadius: "50%",
        background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0, zIndex: 2,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
    </button>
  );
}
