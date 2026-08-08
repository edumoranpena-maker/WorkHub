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
import { X, File as FileIcon, ExternalLink, Download, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { PrivacyIcon } from "../lib/visibility.jsx";
import AudioNotePlayer from "./AudioNotePlayer.jsx";
import ReadAloudButton from "./ReadAloudButton.jsx";
import { resetAudioSession, pauseActiveAudio } from "../lib/audioPlayback.js";
import { stopSpeech } from "../lib/textToSpeech.js";

// Same tiny local hook every other file in this codebase already keeps its
// own copy of (Post.jsx, Tools.jsx, Announcements.jsx, Stats.jsx, etc.) —
// matching that existing convention rather than introducing this file's own
// import path for a one-liner none of the others use either.
function useIsDesktop() {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SWIPE_MIN       = 50;   // px to count as a swipe between items
const SWIPE_RATIO     = 1.4;  // horiz must be N× vertical to be counted
const LOCK_PX         = 8;    // direction lock threshold
const INDICATOR_SHOW  = 5200; // ms the position indicator (and info blocks) stay visible — was 2200, +3000 per request
const MAX_ZOOM        = 5;
const MIN_ZOOM        = 1;
const DOUBLE_TAP_MS   = 280;  // ms window for double-tap-to-zoom
const WHEEL_ZOOM_SENSITIVITY  = 0.0035; // exponential curve — smooth across a mouse's chunky wheel notches and a trackpad's fine-grained deltas alike
const DOUBLE_CLICK_ZOOM_SCALE = 2.5;    // same target scale the existing double-TAP (touch) already zooms to, kept identical for consistency
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
  const overAYear = diff >= 365 * 86400;
  return date.toLocaleDateString("es-ES", overAYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
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
            position: "absolute", top: 78, left: "50%", transform: "translateX(-50%)",
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

// ── Viewer top bar — one continuous bar, mobile and desktop share it ────────
// Replaces what used to be three separate floating pieces (the info card,
// the position-indicator pill, the close button) with a single full-width
// bar — same information, reflowed per breakpoint instead of duplicated:
//   Mobile:   line 1 = author • type: title…              X
//             line 2 = date • privacy icon
//             (position counter stays exactly where it was — its own
//             floating pill below this bar, rendered by the caller)
//   Desktop:  line 1 = author • type: title…            🔍  X
//             line 2 = date • privacy icon         counter (n / total)
// `title` (Post/Subtema only — Updates have none) is truncated with CSS
// ellipsis rather than JS slicing, so it adapts to any width/font-size
// without a magic character count. Reusable across Post/Update/Subtema via
// the same `context` shape as before; description itself still lives in
// MediaBottomPanel, not here.
function ViewerTopBar({ context, visible, isDesktop, current, total, zoomToolActive, onToggleZoomTool, onClose }) {
  if (!context) return null;
  const { author, contentType, title, timestamp, visibility, edited } = context;
  const typeLabel = contentType ? (title ? `${contentType}: ${title}` : contentType) : null;
  const dateParts = [fmtRelativeEs(timestamp), edited ? "Editado" : null].filter(Boolean);
  const showCounter = isDesktop && total > 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            // Dark, semi-transparent, DELIBERATELY light blur — Telegram-style
            // chrome, not a heavy frosted-glass panel.
            background: "rgba(10,10,12,0.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 10px 10px 16px", minHeight: 40 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
              {/* Line 1 — author • type: title, truncated */}
              {(author || typeLabel) && (
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff",
                  textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {author}
                  {author && typeLabel && <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.7)" }}> • </span>}
                  {typeLabel && <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{typeLabel}</span>}
                </div>
              )}
              {/* Line 2 — date • privacy icon, with the counter (desktop
                  only) centered at the MIDDLE of this line — absolutely
                  positioned so it sits at the true horizontal center
                  regardless of how long the date text is, rather than
                  flush against the right edge. */}
              {(dateParts.length > 0 || showCounter) && (
                <div style={{ position: "relative", display: "flex", alignItems: "center", minHeight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    {dateParts.length > 0 && (
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                        color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {dateParts.join(" • ")}
                      </span>
                    )}
                    {visibility && <PrivacyIcon visibility={visibility} size={11} color="rgba(255,255,255,0.7)" />}
                  </div>
                  {showCounter && (
                    <span style={{
                      position: "absolute", left: "50%", transform: "translateX(-50%)",
                      fontFamily: "sans-serif", fontSize: 12, fontWeight: 600,
                      color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em",
                    }}>
                      {current + 1} / {total}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions — zoom tool (desktop only) then close, both part of
                the same bar now instead of a separate floating circle. */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {isDesktop && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleZoomTool(); }}
                  aria-label="Zoom"
                  aria-pressed={zoomToolActive}
                  style={{
                    width: 32, height: 32, borderRadius: "50%", border: "none",
                    background: zoomToolActive ? "rgba(255,255,255,0.22)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "#fff",
                  }}
                >
                  <ZoomIn size={17} strokeWidth={2.2} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close"
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none", background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                }}
              >
                <X size={19} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Media bottom panel — Audio, then Read-aloud, then Description ───────────
// Same bottom-anchored gradient backdrop as before, now stacked as THREE
// independent, optional pieces in normal document flow (no separate
// absolutely-positioned blocks to keep in sync):
//   - AudioNotePlayer, when this content has a recorded voice note (images,
//     files and links — never video, gated by the caller below).
//   - ReadAloudButton, when the description has actual text to read — a
//     completely separate system (browser SpeechSynthesis, not a recorded
//     file) that never interferes with the voice note above it.
//   - The description text, exactly as before (collapse/expand, its own
//     tap-to-expand + internal-scroll-when-expanded behavior).
// Returns null only when there's truly nothing to show — any subset of the
// three (audio-only, description-only, etc.) still renders correctly.
function MediaBottomPanel({ contentId, audio, description, visible, expanded, onExpandChange }) {
  const desc = (description || "").trim();
  if (!audio?.url && !desc) return null;
  const isLong = desc.length > DESCRIPTION_COLLAPSE_LEN;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22 }}
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10,
            paddingTop: 44, // gradient fade-in room above the content
            background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
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
              if (desc && !expanded && isLong) onExpandChange(true);
            }}
            // Mouse-only, always-on stopPropagation (unlike the touch handlers
            // below, which stay conditional on `expanded` for their own
            // reason). This is the fix for the desktop bug where clicking
            // "Ver más" or the text closed the whole viewer: the backdrop's
            // onPointerDown calls setPointerCapture on itself for every mouse
            // press so it can track a possible drag-to-swipe, and it does
            // that check before "click" ever fires — stopping only the click
            // (via onClick above) is too late by then. Stopping pointerdown
            // here means that capture (and the backdrop's whole drag/close
            // tracking) never starts in the first place for a press that
            // began on the description. Filtered to mouse specifically so
            // touch — which never had this bug, and drives its own separate
            // gesture handling below — behaves exactly as it did before.
            onPointerDown={(e) => { if (e.pointerType === "mouse") e.stopPropagation(); }}
            onPointerMove={(e) => { if (e.pointerType === "mouse") e.stopPropagation(); }}
            onPointerUp={(e) => { if (e.pointerType === "mouse") e.stopPropagation(); }}
            // Only intercepts touch (for internal scroll) once expanded —
            // collapsed, a swipe starting over the 2-line preview still
            // reaches the backdrop exactly as it always did.
            onTouchStart={expanded ? (e) => e.stopPropagation() : undefined}
            onTouchMove={expanded ? (e) => e.stopPropagation() : undefined}
            onTouchEnd={expanded ? (e) => e.stopPropagation() : undefined}
          >
            {audio?.url && (
              <div style={{ marginBottom: desc ? 8 : 0 }} onClick={e => e.stopPropagation()}>
                <AudioNotePlayer audio={audio} accentColor="#22d3a0" />
              </div>
            )}
            {desc && (
              <div style={{ marginBottom: 6 }} onClick={e => e.stopPropagation()}>
                <ReadAloudButton id={contentId} text={desc} accentColor="#22d3a0" />
              </div>
            )}
            {desc && (
              <>
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
              </>
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
function ZoomableImage({ src, onZoomChange, zoomToolActive = false, onZoomToolUsed }) {
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const gestureRef = useRef(null);  // tracks active gesture state
  const lastTapRef = useRef(0);
  const mousePanRef = useRef(null); // desktop drag-to-pan, mirrors gestureRef but mouse-only

  // Notify parent of zoom level so it can gate swipe navigation
  useEffect(() => { onZoomChange?.(scale); }, [scale]);

  const clampOffset = (ox, oy, sc, w, h) => {
    const maxX = Math.max(0, (w * sc - w) / 2);
    const maxY = Math.max(0, (h * sc - h) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
  };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  // Shared by wheel-zoom and double-click-zoom: change scale while keeping
  // whatever content point sits under (cx, cy) — coordinates relative to
  // the container's own center — visually fixed on screen, then clamp so
  // the image can never drift off-screen at the new scale. offset.x/y are
  // already plain screen-space pixels regardless of scale (the translate()
  // in the transform below divides by scale specifically so that cancels
  // out), which is what keeps this math simple.
  const zoomToward = (cx, cy, newScaleRaw, el) => {
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newScaleRaw));
    const contentX = (cx - offset.x) / scale;
    const contentY = (cy - offset.y) / scale;
    const rawX = newScale <= 1.001 ? 0 : cx - contentX * newScale;
    const rawY = newScale <= 1.001 ? 0 : cy - contentY * newScale;
    setScale(newScale);
    setOffset(clampOffset(rawX, rawY, newScale, el.offsetWidth, el.offsetHeight));
  };

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

  // ── Desktop: wheel/trackpad zoom ─────────────────────────────────────────
  // A plain mouse wheel and a trackpad's pinch/two-finger-scroll gesture
  // both arrive here as native "wheel" events (browsers report trackpad
  // pinch as wheel with ctrlKey set) — one handler covers "Zoom mediante
  // rueda del mouse" and "Zoom mediante los controles habituales del
  // trackpad" identically, no separate gesture detection needed. Always
  // zooms (never scrolls anything) since the backdrop itself has no scroll
  // of its own to preserve.
  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const zoomFactor = Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY);
    zoomToward(cx, cy, scale * zoomFactor, el);
  };

  // ── Desktop: double-click to zoom, double-click again to reset ──────────
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1.05) { reset(); return; }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    zoomToward(cx, cy, DOUBLE_CLICK_ZOOM_SCALE, el);
  };

  // ── Desktop: explicit "zoom tool" (the magnifier toggle in the top bar) —
  // Notion-style click-to-zoom, single-use ─────────────────────────────────
  // Entirely additive and gated behind zoomToolActive: when the tool isn't
  // toggled on, this is a no-op and every gesture above (wheel, double-
  // click, pinch, drag-to-pan) behaves exactly as it always has — nothing
  // here changes that path. Reuses the exact same zoomToward() as wheel/
  // double-click rather than reimplementing the math a third time.
  // One full use = two clicks: first click zooms in (tool stays armed so
  // the very next click is recognized as the matching zoom-out); second
  // click zooms back out AND calls onZoomToolUsed() to switch the magnifier
  // off — the tool never stays active past that pair, so a third click on
  // the image does nothing until 🔍 is pressed again.
  const handleZoomToolClick = (e) => {
    if (!zoomToolActive) return;
    e.stopPropagation();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    if (scale > 1.05) { reset(); onZoomToolUsed?.(); }
    else zoomToward(cx, cy, DOUBLE_CLICK_ZOOM_SCALE, el);
  };

  // ── Desktop: drag-to-pan once zoomed ─────────────────────────────────────
  // Pointer events (not legacy mouse events) on purpose, and filtered to
  // pointerType==="mouse" specifically — the backdrop's own swipe-to-
  // navigate is also Pointer-based, so using the same event type is what
  // lets stopPropagation here reliably reach it before it starts tracking
  // a drag of its own (mixing event types, e.g. mousedown here vs
  // pointerdown there, wouldn't reliably stop the other — that's the exact
  // class of bug the description-block fix above deals with). Untouched by
  // touch input either way: pointerType would be "touch" there, so every
  // one of these bails immediately and the handlers above keep handling it
  // exactly as they always have.
  const handlePointerDown = (e) => {
    if (e.pointerType !== "mouse" || scale <= 1.05) return;
    e.stopPropagation();
    mousePanRef.current = { startX: e.clientX - offset.x, startY: e.clientY - offset.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const g = mousePanRef.current;
    if (!g) return;
    e.stopPropagation();
    const el = e.currentTarget;
    setOffset(clampOffset(e.clientX - g.startX, e.clientY - g.startY, scale, el.offsetWidth, el.offsetHeight));
  };
  const handlePointerUp = (e) => {
    if (e.pointerType !== "mouse") return;
    if (mousePanRef.current) e.stopPropagation();
    mousePanRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        cursor: zoomToolActive ? (scale > 1.05 ? "zoom-out" : "zoom-in") : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onClick={handleZoomToolClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
          cursor: zoomToolActive ? "inherit" : (scale > 1.05 ? "grab" : "auto"),
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
  // Desktop-only "magnifier" toggle from the top bar — Notion-style explicit
  // click-to-zoom, entirely separate from the always-on wheel/double-click/
  // pinch zoom above. Resets naturally with the rest of this component's
  // state when the viewer closes (unmounts) — no dedicated reset needed.
  const [zoomToolActive, setZoomToolActive] = useState(false);
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

  // Pause (not reset) whichever voice note was playing, and STOP (fully —
  // never resumes) any text-to-speech reading, the moment the swipe crosses
  // into a DIFFERENT content's group — currentGroupIdx changing is exactly
  // that event, and only that event: hiding/showing the description via the
  // chrome auto-hide does NOT touch currentGroupIdx, so it does not trigger
  // this (that was the previous bug — the reader used to stop just because
  // the button housing it unmounted when the chrome hid it, with no actual
  // content change; see textToSpeech.js's file header for the fix). Skipped
  // on mount — opening the viewer on some content must not pause/stop that
  // same content's own just-started audio/reading — and never fires from
  // browsing images within the SAME group, since currentGroupIdx only
  // changes when the content itself changes.
  const isFirstGroupRender = useRef(true);
  useEffect(() => {
    if (isFirstGroupRender.current) { isFirstGroupRender.current = false; return; }
    pauseActiveAudio();
    stopSpeech();
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

  // ── Desktop: arrow-key navigation ──────────────────────────────────────────
  // Scoped to exactly the viewer's own lifetime — this effect only exists
  // while GlobalImageViewer is mounted (which is exactly while the gallery
  // is open, per useImageViewer below), so the listener is added on open and
  // removed on close automatically; nothing else needs to know it existed.
  // Skips while zoomed in (arrow keys aren't a zoomed-pan control here) and
  // while focus is in a real text field (copying/selecting the description
  // shouldn't have arrow keys hijacked into changing the photo underneath).
  const isDesktop = useIsDesktop();
  useEffect(() => {
    if (!isDesktop) return;
    const onKeyDown = (e) => {
      if (zoomScale > 1.05) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(idx + 1, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(idx - 1, -1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, zoomScale, idx, goTo]);

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
        {/* Top bar — author/type/title, date/privacy, close (+ zoom tool on
            desktop). Images, files and links only (never video — video gets
            its own native controls). Re-fed with whichever group is current,
            so it updates automatically as the journey crosses into the next
            content. No local state, nothing to reset per item. */}
        {(current.type === "image" || current.type === "file" || current.type === "link") && (
          <ViewerTopBar
            context={currentGroup.context}
            visible={indicatorVisible}
            isDesktop={isDesktop}
            current={localIdx}
            total={currentGroup.count}
            zoomToolActive={zoomToolActive}
            onToggleZoomTool={() => setZoomToolActive(z => !z)}
            onClose={onClose}
          />
        )}

        {/* Position indicator — mobile only now (unchanged spot/style); on
            desktop the same count moved into the top bar's second line
            instead of a separate floating pill. Local to the current
            content (e.g. "2/3" for the Post's own photos), not a global
            count across the whole Thread journey. */}
        {!isDesktop && (
          <PositionIndicator current={localIdx} total={currentGroup.count} visible={indicatorVisible} />
        )}

        {/* Close button now lives inside ViewerTopBar above — kept as a
            fallback here only for item types that don't show the bar
            (video), so closing is always reachable. */}
        {current.type === "video" && (
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
              // zone — MediaBottomPanel stops propagation on every tap
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
                zoomToolActive={isDesktop && zoomToolActive}
                onZoomToolUsed={() => setZoomToolActive(false)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom panel — Audio then Description, bottom-anchored, own
            gradient/scroll. Rendered after the item frame so it paints above
            it; its own pointer-events scoping (see component) keeps it from
            stealing gestures it doesn't need. Description persists expansion
            across media of the SAME content — see expandedContentId above —
            and resets when the content changes. Both belong to the CONTENT
            (Post/Update/Subtema), not to the item type being viewed, so they
            show for image, file, and link items alike — only video is
            excluded (unchanged from before). */}
        {(current.type === "image" || current.type === "file" || current.type === "link") && (
          <MediaBottomPanel
            contentId={currentGroup.contentId}
            audio={currentGroup.context?.audio}
            description={currentGroup.context?.description}
            visible={indicatorVisible}
            expanded={expanded}
            onExpandChange={handleDescExpandChange}
          />
        )}


        {/* Side arrows — desktop only, and only pointing where there's
            actually something to go to (no prev arrow on the first item,
            no next arrow on the last). Same close-button visual language
            (dark translucent circle, white icon) so it reads as part of
            the same chrome instead of a foreign control. */}
        {isDesktop && idx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goTo(idx - 1, -1); }}
            aria-label="Previous"
            style={{
              position: "fixed", top: "50%", left: 20, transform: "translateY(-50%)",
              width: 44, height: 44, borderRadius: "50%", zIndex: 3001,
              background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
        )}
        {isDesktop && idx < count - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goTo(idx + 1, 1); }}
            aria-label="Next"
            style={{
              position: "fixed", top: "50%", right: 20, transform: "translateY(-50%)",
              width: 44, height: 44, borderRadius: "50%", zIndex: 3001,
              background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <ChevronRight size={22} strokeWidth={2.2} />
          </button>
        )}
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

  const closeImage = useCallback(() => {
    // Closing the viewer restarts playback (per spec) — every other way of
    // navigating away from this content (switching to a different Post/
    // Update/Subtema, or just backgrounding the viewer) only pauses and
    // keeps position, handled entirely inside audioPlayback.js. Reset every
    // voice-note URL this gallery session could have touched: the single
    // `context` case, and every group's context for a cross-content journey.
    // Text-to-speech has no position to preserve across a close — always
    // stops outright.
    if (gallery?.context?.audio?.url) resetAudioSession(gallery.context.audio.url);
    (gallery?.groups || []).forEach(g => { if (g.context?.audio?.url) resetAudioSession(g.context.audio.url); });
    stopSpeech();
    setGallery(null);
  }, [gallery]);

  // The Android/browser back button — the viewer itself never pushes its own
  // history entry, so without this the physical back button would navigate
  // whatever's underneath while leaving the viewer open on top of it. Only
  // listens while a gallery is actually open. Goes through the exact same
  // closeImage() as the X button, so it resets audio identically — not a
  // second, parallel close path.
  useEffect(() => {
    if (!gallery) return;
    const onPopState = () => closeImage();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [gallery, closeImage]);

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
