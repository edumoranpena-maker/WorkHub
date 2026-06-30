/**
 * ChecklistEditor.jsx
 *
 * Fullscreen sheet for creating or editing a master checklist.
 * Opens from CustomSectionContent: Edit Panel → + Añadir bloque → Checklist.
 *
 * Props:
 *   initial : existing checklist to edit, or null to create new
 *   onSave  : (checklist) => void
 *   onClose : () => void
 */

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Plus, GripVertical, Trash2 } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#08080e", surface: "#0e0e18", card: "#13131f",
  border: "#1c1c2e", text: "#fafafa", textMuted: "#8e8e8e",
  teal: "#22d3a0", accent: "#7c4dff", accentLight: "#9d71ff", red: "#ff4f6a",
};

function newItem(text = "") {
  return { id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, checked: false };
}

export default function ChecklistEditor({ initial, onSave, onClose }) {
  const [name, setName]   = useState(initial?.name || "");
  const [items, setItems] = useState(initial?.items?.length ? initial.items : [newItem()]);
  const lastRef = useRef(null);

  const addItem = () => {
    const item = newItem();
    setItems(prev => [...prev, item]);
    setTimeout(() => lastRef.current?.focus(), 60);
  };

  const updateItem = (id, text) => setItems(prev => prev.map(it => it.id === id ? { ...it, text } : it));
  const removeItem = (id)       => setItems(prev => prev.filter(it => it.id !== id));

  const handleKeyDown = (e, id, idx) => {
    if (e.key === "Enter") { e.preventDefault(); addItem(); }
    if (e.key === "Backspace" && items[idx].text === "" && items.length > 1) {
      e.preventDefault();
      removeItem(id);
    }
  };

  const canSave = name.trim().length > 0 && items.some(i => i.text.trim().length > 0);

  const save = () => {
    if (!canSave) return;
    const cleaned = items.filter(i => i.text.trim().length > 0);
    onSave({
      id:    initial?.id || `cl_${Date.now()}`,
      name:  name.trim(),
      items: cleaned,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 2500, background: C.bg, display: "flex", flexDirection: "column" }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${C.border}`, gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, padding: 4, display: "flex" }}>
          <X size={22} strokeWidth={2} />
        </button>
        <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: C.text, flex: 1 }}>
          {initial ? "Edit Checklist" : "New Checklist"}
        </span>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={save}
          disabled={!canSave}
          style={{
            padding: "8px 20px", borderRadius: 99, border: "none", cursor: canSave ? "pointer" : "default",
            background: canSave ? `linear-gradient(135deg, ${C.teal}, #0ea876)` : C.border,
            color: canSave ? "#000" : C.textMuted, fontFamily: font, fontSize: 13, fontWeight: 800,
            transition: "all 0.15s",
          }}
        >
          Save
        </motion.button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 40px" }}>
        {/* Name */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Checklist Name
          </p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Liquidity Pool"
            autoFocus
            style={{
              width: "100%", boxSizing: "border-box",
              background: C.card, border: `1.5px solid ${name.trim() ? C.teal + "55" : C.border}`,
              borderRadius: 12, padding: "12px 14px", color: C.text, fontFamily: font, fontSize: 15,
              fontWeight: 700, outline: "none", transition: "border-color 0.2s",
            }}
          />
        </div>

        {/* Items */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 10px", fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Items
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "4px 8px 4px 12px" }}
              >
                <div style={{ color: C.border, flexShrink: 0, lineHeight: 0 }}>
                  <GripVertical size={14} />
                </div>
                <input
                  ref={idx === items.length - 1 ? lastRef : null}
                  value={item.text}
                  onChange={e => updateItem(item.id, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, item.id, idx)}
                  placeholder={`Item ${idx + 1}`}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: C.text, fontFamily: font, fontSize: 14, padding: "8px 0",
                  }}
                />
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  style={{ background: "none", border: "none", cursor: items.length > 1 ? "pointer" : "default", color: items.length > 1 ? C.red : C.border, padding: 4, display: "flex", flexShrink: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Add item */}
        <button
          onClick={addItem}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 14px",
            borderRadius: 10, border: `1px dashed ${C.teal}40`,
            background: `${C.teal}08`, cursor: "pointer", width: "100%",
          }}
        >
          <Plus size={14} color={C.teal} strokeWidth={2.5} />
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, color: C.teal }}>Add item</span>
        </button>
      </div>
    </motion.div>
  );
}
