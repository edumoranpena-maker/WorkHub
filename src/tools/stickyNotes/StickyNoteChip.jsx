/**
 * StickyNoteChip.jsx
 *
 * One note in the 2-column library grid. Small, square-ish, paper-colored,
 * slightly tilted — meant to read as "a real sticky note", not a
 * dashboard card. Purely presentational: a tap opens StickyNoteExpanded
 * (owned by StickyNotesPage), this component doesn't know about editing,
 * deleting, or navigation between notes.
 *
 * `hidden` is true for whichever note is currently showing in the expanded
 * viewer — its chip is rendered invisible (visibility, not display:none) so
 * the grid keeps its exact layout/spacing while that note is "out" being
 * read, and `gridRef` is how StickyNotesPage measures this exact chip's
 * on-screen rect to compute the grow/shrink origin for the expand
 * animation (see StickyNotesPage.jsx's getGridOffset).
 */
import { motion } from "framer-motion";
import { stickyColor, stickyTilt } from "./stickyNoteColors.js";

const noteFont = "'Segoe Print','Bradley Hand','Comic Sans MS',cursive";

export default function StickyNoteChip({ note, hidden, gridRef, onOpen }) {
  const c = stickyColor(note.color);
  const tilt = stickyTilt(note.id);

  return (
    <div ref={gridRef} style={{ aspectRatio: "1 / 1", visibility: hidden ? "hidden" : "visible" }}>
      <motion.div
        onClick={onOpen}
        whileTap={{ scale: 0.93 }}
        style={{
          width: "100%", height: "100%", boxSizing: "border-box",
          background: c.bg, color: c.text,
          borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 5px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)",
          padding: "13px 12px 11px", position: "relative", overflow: "hidden",
          transform: `rotate(${tilt}deg)`, cursor: "pointer",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Folded corner — a flat diagonal, not a 3D fold */}
        <div style={{
          position: "absolute", top: 0, right: 0, width: 15, height: 15,
          background: `linear-gradient(135deg, transparent 50%, ${c.fold} 50%)`,
          boxShadow: "-1px 1px 2px rgba(0,0,0,0.18)",
        }} />

        <p style={{
          margin: "0 14px 4px 0", fontFamily: noteFont, fontWeight: 700, fontSize: 14,
          lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {note.title || "Sin título"}
        </p>
        <p style={{
          margin: 0, fontFamily: noteFont, fontSize: 11.5, lineHeight: 1.4, opacity: 0.82,
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1,
        }}>
          {note.content || ""}
        </p>
      </motion.div>
    </div>
  );
}
