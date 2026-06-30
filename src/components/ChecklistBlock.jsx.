/**
 * ChecklistBlock.jsx
 *
 * Reusable checklist display component.
 * Used in:
 *   - CustomSectionContent (master checklist view inside a Section)
 *   - Post thread view (interactive copy, state lives in the post)
 *
 * Props:
 *   checklist  : { id, name, items: [{ id, text, checked }] }
 *   onChange   : (updatedChecklist) => void   — called when an item is toggled
 *   readOnly   : boolean (default false)      — disables toggling
 *   accentColor: optional CSS color string
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";

const font = "'DM Sans', sans-serif";

export default function ChecklistBlock({ checklist, onChange, readOnly = false, accentColor = "#22d3a0" }) {
  const [open, setOpen] = useState(true);

  if (!checklist) return null;

  const items    = checklist.items || [];
  const done     = items.filter(i => i.checked).length;
  const total    = items.length;
  const progress = total > 0 ? done / total : 0;

  const toggle = (itemId) => {
    if (readOnly) return;
    const updated = {
      ...checklist,
      items: items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
    };
    onChange?.(updated);
  };

  return (
    <div style={{
      background: "rgba(34,211,160,0.04)",
      border: `1px solid ${accentColor}28`,
      borderRadius: 14,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ color: accentColor, flexShrink: 0, lineHeight: 0 }}>
          {open
            ? <ChevronDown size={16} strokeWidth={2.5} />
            : <ChevronRight size={16} strokeWidth={2.5} />}
        </div>
        <span style={{ fontFamily: font, fontSize: 13, fontWeight: 800, color: "#fafafa", flex: 1, letterSpacing: "-0.01em" }}>
          {checklist.name || "Checklist"}
        </span>
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: done === total && total > 0 ? accentColor : "#8e8e8e" }}>
          {done}/{total}
        </span>
      </button>

      {/* Progress bar */}
      <div style={{ height: 2, background: `${accentColor}18` }}>
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          style={{ height: "100%", background: accentColor, borderRadius: 1 }}
        />
      </div>

      {/* Items */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "6px 10px 10px" }}>
              {items.length === 0 && (
                <p style={{ fontFamily: font, fontSize: 12, color: "#8e8e8e", margin: "4px 4px 0", fontStyle: "italic" }}>
                  No items yet
                </p>
              )}
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  disabled={readOnly}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "7px 4px", background: "none", border: "none",
                    cursor: readOnly ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ flexShrink: 0, lineHeight: 0, color: item.checked ? accentColor : "#8e8e8e" }}>
                    {item.checked
                      ? <CheckSquare size={16} strokeWidth={2} />
                      : <Square size={16} strokeWidth={1.8} />}
                  </div>
                  <span style={{
                    fontFamily: font, fontSize: 13, fontWeight: 500,
                    color: item.checked ? "#8e8e8e" : "#fafafa",
                    textDecoration: item.checked ? "line-through" : "none",
                    lineHeight: 1.4, flex: 1,
                  }}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
