/**
 * GlobalImageViewer.jsx
 *
 * Single reusable fullscreen image viewer for the entire platform.
 * Used by: Post (thread, update, subtema media), Announcements (standard +
 * reveal posts), HomeFeed posts, and the post/update Composer preview.
 *
 * Why centralized: any future change to the viewer (zoom, swipe between
 * multiple images, download button, etc.) only needs to happen here once,
 * instead of being duplicated across 6 components.
 *
 * Explicitly NOT used by Stories — Stories keep their own dedicated
 * StoryViewer implementations (Announcements.jsx and HomeFeed.jsx) untouched.
 *
 * Usage:
 *   const { openImage, ViewerPortal } = useImageViewer();
 *   <img onClick={() => openImage(url)} />
 *   ...
 *   <ViewerPortal />   // mount once near the root of the consuming component
 */

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * The actual fullscreen modal. Rendered via portal to document.body so it
 * always escapes any ancestor's transform/will-change stacking context,
 * regardless of which component opened it (same fix pattern already used
 * for GreenFAB, NewDiffusionSheet and InstagramStoryCreator).
 */
function GlobalImageViewer({ src, onClose }) {
  if (!src) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="global-image-viewer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 3000,
          background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <motion.img
          key="global-image-viewer-img"
          src={src}
          alt=""
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: "94vw", maxHeight: "90vh",
            width: "auto", height: "auto",
            objectFit: "contain", borderRadius: 8,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}
        />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "fixed", top: "max(16px, env(safe-area-inset-top))", right: 16,
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(20,20,20,0.7)", border: "1px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff", zIndex: 3001,
          }}
        >
          <X size={20} strokeWidth={2.2} />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/**
 * Hook that gives any component a ready-to-mount viewer + an opener function.
 * Keeps each consumer's code to two lines: openImage(url) and <ViewerPortal />.
 */
export function useImageViewer() {
  const [src, setSrc] = useState(null);

  const openImage = useCallback((url) => {
    if (url) setSrc(url);
  }, []);

  const closeImage = useCallback(() => setSrc(null), []);

  const ViewerPortal = useCallback(
    () => <GlobalImageViewer src={src} onClose={closeImage} />,
    [src, closeImage]
  );

  return { openImage, closeImage, ViewerPortal };
}

/**
 * Small, non-invasive expand icon meant to sit in the bottom-right corner
 * of any user-uploaded image. Opens the viewer directly on click without
 * needing the parent image's own click/double-tap handler to fire.
 */
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
