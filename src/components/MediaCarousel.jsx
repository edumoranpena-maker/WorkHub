/**
 * MediaCarousel.jsx
 *
 * Reusable media carousel — swipe gestures, dot indicators, fullscreen gallery.
 * Arrows removed (navigation is swipe-only by product decision).
 *
 * When an image is tapped, opens the GlobalImageViewer with the FULL items array
 * starting at the current index, so the user can navigate the entire set in
 * fullscreen without closing the viewer.
 *
 * Used by: UpdateBubble, SubtemaView, ThreadView (Post.jsx),
 *          AnnouncementCard (Announcements.jsx), PostCard (HomeFeed.jsx)
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, File as FileIcon, Link as LinkIcon } from "lucide-react";
import { ExpandImageButton } from "./GlobalImageViewer.jsx";

const SWIPE_MIN_PX  = 40;
const SWIPE_RATIO   = 1.6;
const LOCK_AFTER_PX = 10;

/**
 * items        : Array<{ type: "image"|"video", url: string, thumb?: string }>
 * onOpenGallery: ({ items, startIndex }) => void  — opens fullscreen gallery
 * accentColor  : optional CSS color for dot highlight
 * square       : boolean (default true) — 1:1 in feed; false = 16:9
 */
export default function MediaCarousel({ items = [], onOpenGallery, accentColor = "#7c4dff", square = true }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(0);
  const touchRef      = useRef(null);

  const count   = items.length;
  if (count === 0) return null;
  const current = items[idx];

  const goTo = useCallback((next, direction) => {
    if (next < 0 || next >= count) return;
    setDir(direction);
    setIdx(next);
  }, [count]);

  // ── Touch / swipe ───────────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null, blocked: false };
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
    if (s.locked === "h") { e.stopPropagation(); s.blocked = true; }
  };

  const onTouchEnd = (e) => {
    const s = touchRef.current;
    if (!s) return;
    if (s.locked === "h") {
      const dx = e.changedTouches[0].clientX - s.x;
      e.stopPropagation();
      if (Math.abs(dx) >= SWIPE_MIN_PX) { dx < 0 ? goTo(idx + 1, 1) : goTo(idx - 1, -1); }
    }
    touchRef.current = null;
  };

  // ── Slide variants ──────────────────────────────────────────────────────────
  const variants = {
    enter:  (d) => ({ x: d >= 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d) => ({ x: d >= 0 ? "-100%" : "100%", opacity: 0 }),
  };

  // Open fullscreen gallery at current index
  const openGallery = () => onOpenGallery?.({ items, startIndex: idx });

  return (
    <div
      style={{ position: "relative", width: "100%", userSelect: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Media area ──────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", width: "100%",
        aspectRatio: square ? "1/1" : "16/9",
        overflow: "hidden", borderRadius: 12, background: "#000",
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
            ) : current.type === "file" ? (
              <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#12121c", cursor: onOpenGallery ? "pointer" : "default" }}
                onClick={openGallery}>
                <FileIcon size={30} color="#8e8e8e" strokeWidth={1.5} />
                <span style={{ color: "#c8c8d4", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {current.name || "Archivo"}
                </span>
              </div>
            ) : current.type === "link" ? (
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <a
                  href={current.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "block", width: "100%", height: "100%", position: "relative" }}
                >
                  {current.thumb ? (
                    <>
                      <img
                        src={current.thumb}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 45%)" }} />
                      <div style={{ position: "absolute", left: 10, bottom: 10, right: onOpenGallery ? 40 : 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <ExternalLink size={12} color="#fff" style={{ flexShrink: 0 }} />
                        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {current.title || "Enlace"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#12121c", padding: "0 16px" }}>
                      <LinkIcon size={26} color="#22d3a0" strokeWidth={1.5} />
                      <span style={{ color: "#c8c8d4", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                        {current.title || "Enlace"}
                      </span>
                      {current.site && (
                        <span style={{ color: "#8e8e8e", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>{current.site}</span>
                      )}
                    </div>
                  )}
                </a>
                {onOpenGallery && <ExpandImageButton onClick={openGallery} />}
              </div>
            ) : (
              <>
                <img
                  src={current.thumb || current.url}
                  alt=""
                  onClick={openGallery}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }}
                />
                {onOpenGallery && (
                  <ExpandImageButton onClick={openGallery} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dot indicators ──────────────────────────────────────────────────── */}
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
