/**
 * MediaCarousel.jsx
 *
 * Reusable 1:1 media carousel with swipe gestures, arrow navigation,
 * dot indicators, and fullscreen viewer integration.
 *
 * Used by: UpdateBubble, SubtemaView, ThreadView (Post.jsx),
 *          AnnouncementCard (Announcements.jsx), PostCard (HomeFeed.jsx)
 *
 * Design decisions:
 * - 1:1 (square) aspect ratio in feed; original proportions in fullscreen.
 * - Videos show inline with controls; images open fullscreen on tap.
 * - Swipe ON the carousel → navigate media items.
 * - Swipe OUTSIDE the carousel → falls through to App's section navigation.
 *   Achieved by stopPropagation on touch events that start inside the carousel
 *   and have a clear horizontal intent.
 * - Arrows are rendered only when there are multiple items.
 * - Dot indicators shown when items > 1 (max 8 dots, then "N/total" text).
 * - ExpandImageButton on each image item for direct fullscreen access.
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExpandImageButton } from "./GlobalImageViewer.jsx";

// Swipe detection thresholds
const SWIPE_MIN_PX   = 40;   // minimum horizontal travel to count as a swipe
const SWIPE_RATIO    = 1.6;  // horizontal must be N× the vertical travel
const LOCK_AFTER_PX  = 10;   // lock direction after this many pixels

/**
 * items: Array<{ type: "image"|"video", url: string, thumb?: string }>
 * onOpenImage: (url: string) => void  — opens the fullscreen viewer
 * accentColor: optional CSS color for dot/arrow highlight
 * square: boolean (default true) — whether to enforce 1:1 aspect ratio
 */
export default function MediaCarousel({ items = [], onOpenImage, accentColor = "#7c4dff", square = true }) {
  const [idx, setIdx]       = useState(0);
  const [dir, setDir]       = useState(0);  // -1 | 0 | 1 for slide direction
  const touchRef            = useRef(null); // { x, y, locked, blocked }
  const containerRef        = useRef(null);

  const count = items.length;
  if (count === 0) return null;

  const current = items[idx];

  const goTo = useCallback((next, direction) => {
    if (next < 0 || next >= count) return;
    setDir(direction);
    setIdx(next);
  }, [count]);

  const prev = () => goTo(idx - 1, -1);
  const next = () => goTo(idx + 1,  1);

  // ── Touch handlers — intercept horizontal swipes on the carousel,
  // let vertical and ambiguous gestures fall through ──────────────────────────
  const onTouchStart = (e) => {
    touchRef.current = {
      x:       e.touches[0].clientX,
      y:       e.touches[0].clientY,
      locked:  null,    // "h" | "v" | null
      blocked: false,   // true once we stopPropagation
    };
  };

  const onTouchMove = (e) => {
    const s = touchRef.current;
    if (!s || s.blocked) return;
    const dx = Math.abs(e.touches[0].clientX - s.x);
    const dy = Math.abs(e.touches[0].clientY - s.y);
    if (s.locked) return;
    if (dx > LOCK_AFTER_PX || dy > LOCK_AFTER_PX) {
      s.locked = dx > dy * SWIPE_RATIO ? "h" : "v";
    }
    // Only block propagation once we've confirmed a horizontal swipe intent
    if (s.locked === "h") {
      e.stopPropagation();
      s.blocked = true;
    }
  };

  const onTouchEnd = (e) => {
    const s = touchRef.current;
    if (!s) return;
    if (s.locked === "h") {
      const dx = e.changedTouches[0].clientX - s.x;
      e.stopPropagation();
      if (Math.abs(dx) >= SWIPE_MIN_PX) {
        dx < 0 ? next() : prev();
      }
    }
    touchRef.current = null;
  };

  // ── Slide animation variants ────────────────────────────────────────────────
  const variants = {
    enter:  (d) => ({ x: d >= 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d) => ({ x: d >= 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", userSelect: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Media area ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        width: "100%",
        aspectRatio: square ? "1/1" : "16/9",
        overflow: "hidden",
        borderRadius: 12,
        background: "#000",
      }}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={idx}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: "absolute", inset: 0 }}
          >
            {current.type === "video" ? (
              <video
                src={current.url}
                controls
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <>
                <img
                  src={current.thumb || current.url}
                  alt=""
                  onClick={() => onOpenImage?.(current.url)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }}
                />
                {onOpenImage && (
                  <ExpandImageButton onClick={() => onOpenImage(current.url)} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Arrow buttons (only when multiple items) ───────────────────── */}
        {count > 1 && (
          <>
            {idx > 0 && (
              <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous"
                style={{
                  position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  width: 30, height: 30, borderRadius: "50%", zIndex: 2,
                  background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", backdropFilter: "blur(4px)",
                }}>
                <ChevronLeft size={16} color="#fff" strokeWidth={2.5} />
              </button>
            )}
            {idx < count - 1 && (
              <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  width: 30, height: 30, borderRadius: "50%", zIndex: 2,
                  background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", backdropFilter: "blur(4px)",
                }}>
                <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Dot indicators ─────────────────────────────────────────────────── */}
      {count > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 8 }}>
          {count <= 8 ? (
            items.map((_, i) => (
              <button key={i} onClick={() => goTo(i, i > idx ? 1 : -1)}
                style={{
                  width: i === idx ? 14 : 6, height: 6, borderRadius: 3, border: "none",
                  background: i === idx ? accentColor : "rgba(255,255,255,0.25)",
                  cursor: "pointer", padding: 0,
                  transition: "width 0.18s ease, background 0.18s ease",
                }}
              />
            ))
          ) : (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "sans-serif" }}>
              {idx + 1} / {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
