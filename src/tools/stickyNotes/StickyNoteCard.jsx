/**
 * StickyNoteCard.jsx
 *
 * One note in the library grid. Presentational only — tapping the card
 * opens it for editing, the 3-dot menu offers Delete. No knowledge of
 * Supabase or of how it'll eventually be picked from Profile; that
 * selection flow is a future phase and doesn't change this component.
 */
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MoreVertical, Trash2, Pencil, StickyNote } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#4a4a5e",
  gold: "#d4a843", red: "#ff4f6a",
};

export default function StickyNoteCard({ note, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      style={{ position: "relative", cursor: "pointer", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 14px 12px", display: "flex", flexDirection: "column", minHeight: 118 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <StickyNote size={13} color={C.gold} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: font, fontSize: 13.5, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {note.title || "Sin título"}
          </span>
        </div>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 2 }}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#181824", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", zIndex: 10, minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
            >
              <button
                onClick={() => { setMenuOpen(false); onOpen(); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", color: C.text, fontFamily: font, fontSize: 12.5, fontWeight: 600 }}
              >
                <Pencil size={13} /> Editar
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", color: C.red, fontFamily: font, fontSize: 12.5, fontWeight: 600 }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <p style={{
        margin: 0, fontFamily: font, fontSize: 12.5, color: C.textMuted, lineHeight: 1.5,
        display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1,
      }}>
        {note.content || <span style={{ color: C.textDim, fontStyle: "italic" }}>Sin contenido</span>}
      </p>
    </motion.div>
  );
}
