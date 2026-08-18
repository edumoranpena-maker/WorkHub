/**
 * StickyNoteExpanded.jsx
 *
 * The enlarged note: grows out of its grid slot into a centered "floating"
 * note over a blurred/dimmed grid, can be paged left/right to adjacent
 * notes (swipe on mobile, arrow keys on desktop), and turns into direct
 * inline editing (no separate composer) with debounced autosave.
 *
 * Two independent animations live here, deliberately kept separate:
 *  - The FRAME (this note's paper rectangle) grows in from wherever its
 *    chip sits in the grid, and shrinks back to wherever the *currently
 *    shown* note's chip sits when closed — driven imperatively via
 *    `animate`/`onAnimationComplete`, not AnimatePresence's `exit`, so the
 *    unmount only happens once the shrink has actually finished on screen.
 *  - The CONTENT inside the frame cross-fades/slides horizontally when
 *    paging between notes — a plain index-keyed AnimatePresence, same
 *    "swipeable, direction-aware" idea GlobalImageViewer.jsx already uses
 *    for paging between media, reimplemented fresh here (no import/shared
 *    code — Sticky Notes stays architecturally independent) since a single
 *    drag="x" handle is all this needs.
 *
 * Navigation is fully disabled while `editing` is true, per spec: no
 * swipe, no arrow keys, no accidental note switch while there's unsaved
 * text in flight. Closing (or the rare case of some other close trigger)
 * while editing flushes the pending autosave first.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, Trash2, Pencil, Check } from "lucide-react";
import { STICKY_COLOR_IDS, stickyColor } from "./stickyNoteColors.js";
import { updateStickyNote } from "../../lib/stickyNotesApi.js";

const noteFont = "'Segoe Print','Bradley Hand','Comic Sans MS',cursive";
const uiFont = "'DM Sans', sans-serif";
const AUTOSAVE_DELAY = 700;

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 26 : -26, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -26 : 26, opacity: 0 }),
};

export default function StickyNoteExpanded({
  notes, index, setIndex, originOffset, getGridOffset,
  onNoteUpdated, onDeleteRequest, onClosed, isDesktop, startInEditMode,
}) {
  const note = notes[index];
  const c = stickyColor(note.color);

  const [dir, setDir] = useState(0);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("idle"); // idle | typing | saving | saved
  const [localTitle, setLocalTitle] = useState(note.title);
  const [localContent, setLocalContent] = useState(note.content);
  const [closing, setClosing] = useState(false);
  const [closeTarget, setCloseTarget] = useState(originOffset);

  const dirtyRef = useRef(false);
  const bufferRef = useRef({});
  const timerRef = useRef(null);
  const contentRef = useRef(null);

  // ── Navigation between notes (read mode only) ──────────────────────────
  const go = useCallback((delta) => {
    if (editing) return;
    const next = index + delta;
    if (next < 0 || next >= notes.length) return;
    setDir(delta);
    setIndex(next);
    setMenuOpen(false);
  }, [editing, index, notes.length, setIndex]);

  useEffect(() => {
    if (editing || closing) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, closing, go]);

  // ── Autosave ─────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveLabel("saving");
    const patch = bufferRef.current;
    bufferRef.current = {};
    const updated = await updateStickyNote(note.id, patch);
    if (updated) {
      onNoteUpdated(updated);
      setSaveLabel("saved");
      setTimeout(() => setSaveLabel(l => (l === "saved" ? "idle" : l)), 1300);
    } else {
      setSaveLabel("idle");
    }
  }, [note.id, onNoteUpdated]);

  const scheduleSave = useCallback((patch) => {
    bufferRef.current = { ...bufferRef.current, ...patch };
    dirtyRef.current = true;
    setSaveLabel("typing");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY);
  }, [flush]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const startEditing = () => {
    setMenuOpen(false);
    setLocalTitle(note.title);
    setLocalContent(note.content);
    setEditing(true);
    setTimeout(() => contentRef.current?.focus(), 60);
  };

  // A brand-new note (created via "+") opens straight into edit mode — no
  // separate composer exists anymore, so "create" IS "open blank + edit".
  // Only ever fires once, right after this component mounts for that note.
  useEffect(() => {
    if (startInEditMode) startEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishEditing = async () => {
    setEditing(false);
    await flush(); // guarantees nothing typed is lost the moment editing ends
  };

  const changeColor = async (colorId) => {
    setMenuOpen(false);
    bufferRef.current = { ...bufferRef.current, color: colorId };
    dirtyRef.current = true;
    onNoteUpdated({ ...note, color: colorId }); // instant local reflect
    await flush(); // color persists immediately, not debounced
  };

  // ── Close (shrink back to this note's live grid slot) ──────────────────
  const requestClose = async () => {
    if (closing) return;
    if (editing) { setEditing(false); await flush(); }
    setCloseTarget(getGridOffset(note.id) || originOffset);
    setClosing(true);
  };

  const savedCount = notes.length;

  return (
    <motion.div
      onClick={() => !editing && requestClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.28 }}
      style={{
        position: "fixed", inset: 0, zIndex: 3100, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ x: originOffset.x, y: originOffset.y, scale: 0.22, opacity: 0 }}
        animate={
          closing
            ? { x: closeTarget.x, y: closeTarget.y, scale: 0.22, opacity: 0 }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
        }
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onAnimationComplete={() => { if (closing) onClosed(); }}
        drag={!editing && !closing ? "x" : false}
        dragElastic={0.18}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(e, info) => {
          if (info.offset.x < -55) go(1);
          else if (info.offset.x > 55) go(-1);
        }}
        style={{
          width: "min(90vw, 360px)", maxHeight: "74vh",
          background: c.bg, color: c.text, borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 22px 48px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.3)",
          padding: "18px 18px 16px", display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* folded corner */}
        <div style={{
          position: "absolute", top: 0, right: 0, width: 26, height: 26,
          background: `linear-gradient(135deg, transparent 50%, ${c.fold} 50%)`,
          boxShadow: "-2px 2px 4px rgba(0,0,0,0.2)", pointerEvents: "none",
        }} />

        {/* corner controls */}
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 4, zIndex: 2 }}>
          {editing ? (
            <button onClick={finishEditing}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 20, padding: "5px 10px", cursor: "pointer", color: c.text, fontFamily: uiFont, fontSize: 11.5, fontWeight: 700 }}>
              <Check size={13} /> Listo
            </button>
          ) : (
            <div style={{ position: "relative" }}>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.text }}>
                <MoreVertical size={15} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -4 }}
                    transition={{ duration: 0.12 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: "absolute", top: "115%", right: 0, background: "#181824", border: "1px solid #1c1c2e", borderRadius: 12, padding: 8, minWidth: 168, boxShadow: "0 10px 28px rgba(0,0,0,0.45)" }}
                  >
                    <button onClick={startEditing}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", background: "none", border: "none", cursor: "pointer", color: "#fafafa", fontFamily: uiFont, fontSize: 12.5, fontWeight: 600, borderRadius: 8 }}>
                      <Pencil size={13} /> Editar
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 9px 6px" }}>
                      {STICKY_COLOR_IDS.map(id => {
                        const cc = stickyColor(id);
                        return (
                          <button key={id} onClick={() => changeColor(id)} title={cc.label}
                            style={{
                              width: 18, height: 18, borderRadius: "50%", background: cc.bg, cursor: "pointer",
                              border: id === note.color ? "2px solid #d4a843" : "1px solid rgba(255,255,255,0.15)",
                              padding: 0,
                            }} />
                        );
                      })}
                    </div>

                    <button onClick={() => { setMenuOpen(false); onDeleteRequest(note); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", background: "none", border: "none", cursor: "pointer", color: "#ff4f6a", fontFamily: uiFont, fontSize: 12.5, fontWeight: 600, borderRadius: 8, marginTop: 2 }}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* swipeable content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: 22 }}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={note.id} custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}
            >
              {editing ? (
                <>
                  <input
                    value={localTitle}
                    onChange={(e) => { setLocalTitle(e.target.value); scheduleSave({ title: e.target.value }); }}
                    placeholder="Título"
                    maxLength={80}
                    style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: noteFont, fontWeight: 700, fontSize: 19, color: c.text, marginBottom: 8, padding: 0 }}
                  />
                  <textarea
                    ref={contentRef}
                    value={localContent}
                    onChange={(e) => { setLocalContent(e.target.value); scheduleSave({ content: e.target.value }); }}
                    placeholder="Escribe algo…"
                    rows={8}
                    style={{ width: "100%", minHeight: 180, background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: noteFont, fontSize: 15.5, lineHeight: 1.55, color: c.text, padding: 0 }}
                  />
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px", fontFamily: noteFont, fontWeight: 700, fontSize: 19, lineHeight: 1.25, color: c.text }}>
                    {note.title || "Sin título"}
                  </p>
                  <p style={{ margin: 0, fontFamily: noteFont, fontSize: 15.5, lineHeight: 1.55, color: c.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {note.content || <span style={{ opacity: 0.55, fontStyle: "italic" }}>Nota vacía — toca ⋮ → Editar</span>}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer: autosave label + position indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, minHeight: 16 }}>
          <span style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: c.text, opacity: saveLabel === "idle" ? 0 : 0.6, transition: "opacity 0.15s" }}>
            {saveLabel === "typing" && "Editando…"}
            {saveLabel === "saving" && "Guardando…"}
            {saveLabel === "saved" && "✓ Guardado"}
          </span>
          {savedCount > 1 && !editing && (
            <span style={{ fontFamily: uiFont, fontSize: 10.5, fontWeight: 600, color: c.text, opacity: 0.45 }}>
              {index + 1}/{savedCount}
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
