/**
 * PostOptionsMenu.jsx
 *
 * Three-vertical-dots options menu, reused for Posts, Updates, Subtemas and
 * Subtema-posts. Actions are data-driven so adding a new option later is a
 * one-line change — no new component needed.
 *
 * Usage:
 *   <PostOptionsMenu
 *     actions={[
 *       { id: "edit",   label: "Editar",    icon: Pencil, onSelect: () => ... },
 *       { id: "share",  label: "Compartir", icon: Share2, onSelect: () => ... },
 *       { id: "report", label: "Reportar",  icon: Flag,   onSelect: () => ..., danger: true },
 *     ]}
 *   />
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", red: "#ff4f6a",
};

export default function PostOptionsMenu({ actions = [], size = 30, align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(o => !o)}
        style={{
          width: size, height: size, borderRadius: "50%",
          border: `1px solid ${open ? C.border : "transparent"}`,
          background: open ? C.card : "transparent",
          color: C.textMuted, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <MoreVertical size={16} strokeWidth={2.2} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", zIndex: 250,
              [align]: 0,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: 6, minWidth: 168, boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
            }}
          >
            {actions.map(a => (
              <button
                key={a.id}
                onClick={() => { setOpen(false); a.onSelect?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 10px", borderRadius: 10, border: "none",
                  background: "transparent", cursor: "pointer",
                  fontFamily: font, fontSize: 13, fontWeight: 600,
                  color: a.danger ? C.red : C.text,
                }}
              >
                {a.icon && <a.icon size={14} color={a.danger ? C.red : C.textMuted} strokeWidth={2} />}
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
