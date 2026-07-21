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

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import { Pencil, ClipboardCheck, Trash2, Share2, Flag, Pin, PinOff } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#13131f", surface: "#0e0e18", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", red: "#ff4f6a",
};

/**
 * Standard Editar/Compartir/Eliminar/Reportar action list for a piece of
 * content (Post, Update or Subtema).
 *
 * onRegister is optional and only used by Post/PostCard right now — passing
 * it inserts "Registrar" right after "Editar"; omit it anywhere else (Update,
 * Subtema) and it simply doesn't appear, same as any other action here.
 *
 * onTogglePin is optional too, only used by PostCard (top-level Posts in
 * PostFeed — pinning doesn't apply to Updates or Subtemas). Pass `pinned`
 * alongside it so the label/icon flip between "Fijar post" and "Desfijar
 * post". Appended last, after every existing action, per product decision.
 *
 * `roles` on each action is NOT enforced anywhere yet (no role system wired
 * up per product decision) — it's there so that later, filtering by the
 * current user's role is a one-line change wherever this is called:
 *
 *   buildContentMenuActions({...}).filter(a => a.roles.includes(currentUserRole))
 *
 * Only pass the callbacks that make sense for the calling context — an
 * action is included only if its onSelect was actually provided.
 */
export function buildContentMenuActions({ onEdit, onRegister, onShare, onDelete, onReport, pinned, onTogglePin }) {
  return [
    { id: "edit",     label: "Editar",    icon: Pencil,        roles: ["host"],           onSelect: onEdit },
    { id: "register", label: "Registrar", icon: ClipboardCheck, roles: ["host"],           onSelect: onRegister },
    { id: "share",    label: "Compartir", icon: Share2,        roles: ["host", "member"], onSelect: onShare },
    { id: "delete",   label: "Eliminar",  icon: Trash2,        roles: ["host"],           onSelect: onDelete, danger: true },
    { id: "report",   label: "Reportar",  icon: Flag,          roles: ["host", "member"], onSelect: onReport, danger: true },
    { id: "pin",      label: pinned ? "Desfijar post" : "Fijar post", icon: pinned ? PinOff : Pin, roles: ["host"], onSelect: onTogglePin },
  ].filter(a => typeof a.onSelect === "function");
}

export default function PostOptionsMenu({ actions = [], size = 30, align = "right" }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null); // { top, left?, right? } — computed from the trigger's real screen position
  const wrapRef = useRef(null); // the trigger button's own wrapper (for outside-click detection on that side)
  const menuRef = useRef(null); // the portaled dropdown itself (also needed for outside-click detection)

  const openMenu = useCallback(() => {
    const btn = wrapRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos(
      align === "right"
        ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 6, left: rect.left }
    );
    setOpen(true);
  }, [align]);

  useEffect(() => {
    if (!open) return;
    // A click is "outside" only if it's outside BOTH the trigger and the
    // (now portaled, so no longer a DOM descendant of the trigger) menu.
    const handler = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    // The menu is `position:fixed` at coordinates captured at open time — if
    // the card underneath scrolls, those coordinates go stale and the menu
    // would visually drift away from its trigger. Simplest correct fix:
    // close it on scroll, same as most native dropdowns do.
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => (open ? setOpen(false) : openMenu())}
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

      {menuPos && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: "fixed", top: menuPos.top, left: menuPos.left, right: menuPos.right, zIndex: 900,
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
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
