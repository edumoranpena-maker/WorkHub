/**
 * ConfirmDialog.jsx
 *
 * Generic confirmation modal for destructive actions. First use case is
 * "delete this Post/Update/Subtema", but it's intentionally generic so it
 * can be reused for any other irreversible action later.
 */

import { motion, AnimatePresence } from "framer-motion";

const font = "'DM Sans', sans-serif";
const C = { card: "#13131f", border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e", red: "#ff4f6a" };

export default function ConfirmDialog({
  open,
  title,
  subtitle,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
          style={{ position: "fixed", inset: 0, zIndex: 3200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, width: "100%", maxWidth: 300 }}
          >
            <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>{title}</p>
            {subtitle && <p style={{ margin: "0 0 18px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{subtitle}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: subtitle ? 0 : 16 }}>
              <button onClick={onCancel}
                style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600 }}>
                {cancelLabel}
              </button>
              <button onClick={onConfirm}
                style={{ flex: 1, padding: "10px 0", borderRadius: 11, border: "none", background: danger ? C.red : "#22d3a0", color: danger ? "#fff" : "#000", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700 }}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
