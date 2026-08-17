/**
 * StickyNoteEditorModal.jsx
 *
 * Create/edit form for a single Sticky Note. Same centered-modal shell as
 * components/ConfirmDialog.jsx (fixed inset backdrop + click-outside-to-
 * dismiss + a centered card) — that file was the reference precisely
 * because it's a small, stable, already-working overlay with nothing
 * Checklist-related in it.
 *
 * Fully controlled from the outside: StickyNotesPage.jsx owns whether this
 * is open and in which mode, this component only owns the two text fields
 * while it's open. `note` is null when creating, a note object when
 * editing.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e",
  gold: "#d4a843", bg: "#000000",
};

export default function StickyNoteEditorModal({ open, note, saving, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const titleRef = useRef(null);

  // Re-seed fields every time the modal opens (new note vs editing an
  // existing one) — not on every keystroke, so this only fires on the
  // open/note transition, matching PostComposer's own "initial" convention.
  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, note]);

  const canSave = title.trim().length > 0 || content.trim().length > 0;

  const handleSave = () => {
    if (!canSave || saving) return;
    onSave({ title: title.trim(), content: content.trim() });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, width: "100%", maxWidth: 440, maxHeight: "82vh", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>
                {note ? "Editar nota" : "Nueva Sticky Note"}
              </p>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 2 }}>
                <X size={18} />
              </button>
            </div>

            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título"
              maxLength={80}
              style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 11, padding: "11px 13px", color: C.text, fontFamily: font, fontSize: 14.5, fontWeight: 700, outline: "none", marginBottom: 10, caretColor: C.gold }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Contenido…"
              rows={8}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", flex: 1, minHeight: 140, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 11, padding: "11px 13px", color: C.text, fontFamily: font, fontSize: 14, lineHeight: 1.55, outline: "none", caretColor: C.gold }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!canSave || saving}
                style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "none", background: C.gold, color: "#000", cursor: canSave && !saving ? "pointer" : "default", opacity: canSave && !saving ? 1 : 0.5, fontFamily: font, fontSize: 13, fontWeight: 800 }}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
