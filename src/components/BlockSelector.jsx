/**
 * BlockSelector.jsx
 *
 * Bottom sheet that lets the user pick which type of block to add.
 * Currently only "Checklist" is implemented. More types (Text, Image, Link,
 * Video…) can be added later by pushing entries into BLOCK_TYPES without
 * touching anything else in the app.
 *
 * Props:
 *   onSelect : (blockTypeId: string) => void
 *   onClose  : () => void
 */

import { motion } from "framer-motion";
import { CheckSquare, AlignLeft, Image, Link, Video, X } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", teal: "#22d3a0",
  accent: "#7c4dff", accentLight: "#9d71ff",
};

// ── Block registry ────────────────────────────────────────────────────────────
// Add new block types here when implementing them. `available: false` entries
// render as coming-soon and are not selectable.
const BLOCK_TYPES = [
  {
    id:          "checklist",
    label:       "Checklist",
    description: "Items to check off during a trade",
    icon:        CheckSquare,
    color:       "#22d3a0",
    available:   true,
  },
  {
    id:          "text",
    label:       "Text",
    description: "Notes, analysis, or commentary",
    icon:        AlignLeft,
    color:       "#9d71ff",
    available:   false,
  },
  {
    id:          "image",
    label:       "Image",
    description: "Charts, screenshots, drawings",
    icon:        Image,
    color:       "#4fa3ff",
    available:   false,
  },
  {
    id:          "link",
    label:       "Link",
    description: "Reference resources or tools",
    icon:        Link,
    color:       "#f5a623",
    available:   false,
  },
  {
    id:          "video",
    label:       "Video",
    description: "Recordings or walkthroughs",
    icon:        Video,
    color:       "#ff4f6a",
    available:   false,
  },
];

export default function BlockSelector({ onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2400,
        background: "rgba(8,8,14,0.80)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: C.card, borderRadius: "20px 20px 0 0",
          border: `1px solid ${C.border}`, borderBottom: "none",
          padding: "16px 16px 40px",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 16px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, flex: 1 }}>
            Add Block
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: 4, display: "flex" }}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Block list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {BLOCK_TYPES.map(bt => {
            const Icon = bt.icon;
            return (
              <button
                key={bt.id}
                onClick={() => { if (bt.available) onSelect(bt.id); }}
                disabled={!bt.available}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 14px", borderRadius: 12, width: "100%", textAlign: "left",
                  background: bt.available ? `${bt.color}0a` : "transparent",
                  border: `1px solid ${bt.available ? bt.color + "28" : C.border}`,
                  cursor: bt.available ? "pointer" : "default",
                  opacity: bt.available ? 1 : 0.4,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `${bt.color}18`, border: `1px solid ${bt.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={18} color={bt.color} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontFamily: font, fontSize: 14, fontWeight: 700, color: bt.available ? C.text : C.textMuted }}>
                    {bt.label}
                    {!bt.available && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Soon</span>}
                  </p>
                  <p style={{ margin: "2px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted }}>
                    {bt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
