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

// ── Constants ────────────────────────────────────────────────────────────────
const SWIPE_MIN       = 50;   // px to count as a swipe between items
const SWIPE_RATIO     = 1.4;  // horiz must be N× vertical to be counted
const LOCK_PX         = 8;    // direction lock threshold
const INDICATOR_SHOW  = 2200; // ms the position indicator stays visible
const MAX_ZOOM        = 5;
const MIN_ZOOM        = 1;
const DOUBLE_TAP_MS   = 280;  // ms window for double-tap-to-zoom

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

// ── Link pane — shown when the viewer swipes to a link-preview item ───────────
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
    e.stopPropagation();
    if (e.touches.length === 1) {
      // detect double-tap-to-zoom
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
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
    } else if (e.touches.length === 2) {
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
    e.stopPropagation();
    const g = gestureRef.current;
    if (!g) return;
    if (g.type === "pan" && scale > 1) {
      const el = e.currentTarget;
      const ox = e.touches[0].clientX - g.startX;
      const oy = e.touches[0].clientY - g.startY;
      setOffset(clampOffset(ox, oy, scale, el.offsetWidth, el.offsetHeight));
    } else if (g.type === "pinch" && e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, g.startScale * (dist / g.startDist)));
      setScale(newScale);
      if (newScale <= 1) setOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchEnd = (e) => {
    e.stopPropagation();
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
function GlobalImageViewer({ items, startIndex, onClose }) {
  const [idx, setIdx]           = useState(startIndex ?? 0);
  const [dir, setDir]           = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [indicatorVisible, setIndicatorVisible] = useState(true);
  const indicatorTimer          = useRef(null);
  const touchRef                = useRef(null);
  const mouseRef                = useRef(null);
  const didDragRef              = useRef(false);
  const count                   = items.length;
  const current                 = items[idx] ?? items[0];

  // Lock viewport zoom while viewer is open
  useEffect(() => {
    lockViewportZoom();
    return () => unlockViewportZoom();
  }, []);

  // Auto-hide indicator
  const showIndicator = useCallback(() => {
    setIndicatorVisible(true);
    clearTimeout(indicatorTimer.current);
    indicatorTimer.current = setTimeout(() => setIndicatorVisible(false), INDICATOR_SHOW);
  }, []);

  useEffect(() => {
    showIndicator();
    return () => clearTimeout(indicatorTimer.current);
  }, [idx]);

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
        {/* Position indicator */}
        <PositionIndicator current={idx} total={count} visible={indicatorVisible} />

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
              // Tap on image toggles indicator visibility (only for images)
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
  const [gallery, setGallery] = useState(null); // { items, startIndex }

  /** Open the gallery at a specific index.
   *  openGallery({ items, startIndex }) for multi-item context
   *  openGallery({ items: [{ type:"image", url }], startIndex: 0 }) for single image
   */
  const openGallery = useCallback(({ items, startIndex = 0 }) => {
    if (items?.length) setGallery({ items, startIndex });
  }, []);

  /** Backward-compat: openImage(url) still works for single images */
  const openImage = useCallback((url) => {
    if (url) setGallery({ items: [{ type: "image", url }], startIndex: 0 });
  }, []);

  const closeImage = useCallback(() => setGallery(null), []);

  const ViewerPortal = useCallback(
    () => gallery
      ? <GlobalImageViewer items={gallery.items} startIndex={gallery.startIndex} onClose={closeImage} />
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
