/**
 * StickyNotesProfileWidget.jsx
 *
 * Profile's "Sticky Notes" section: a one-note-at-a-time carousel that sits
 * below the Latest Trades / Reviews row on the Perfil feed (see App.jsx's
 * PerfilContent). Deliberately thin — it owns only the carousel position
 * (which note is showing) and reuses the real Sticky Notes data/components
 * as-is:
 *
 *   - fetchStickyNotes() / deleteStickyNote() from lib/stickyNotesApi.js —
 *     the exact same source of truth StickyNotesPage.jsx reads from. No new
 *     table, no new fetch shape, no separate "profile notes" concept.
 *   - StickyNoteChip for the note's paper-card look (same DM Sans/tilt/fold
 *     visual identity as the Tool's own grid).
 *   - StickyNoteExpanded for the fullscreen viewer — same ⋮ menu, same
 *     inline editing/autosave, same delete flow. This widget doesn't
 *     reimplement any of that; it only feeds it `notes`/`index` exactly the
 *     way StickyNotesPage.jsx does.
 *
 * fetchStickyNotes() already returns notes most-recently-updated first, so
 * `index = 0` on load *is* "most recently created or updated" — no extra
 * sorting needed here.
 *
 * One simplification versus the grid: StickyNotesPage tracks a rect per
 * note (gridRefsMap, keyed by note id) because every note's chip is mounted
 * at once. Here only one note is ever on screen at a time, so there's just
 * a single chipElRef — getGridOffset() below ignores the note id it's asked
 * about and always returns *this widget's on-screen slot*, so closing the
 * expanded viewer (even after paging to a different note inside it) always
 * shrinks back into this same carousel position, which is the correct
 * behavior for a single-slot widget.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StickyNoteChip from "./StickyNoteChip.jsx";
import StickyNoteExpanded from "./StickyNoteExpanded.jsx";
import { fetchStickyNotes, deleteStickyNote } from "../../lib/stickyNotesApi.js";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#4a4a5e",
};

function ArrowBtn({ dir, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Nota anterior" : "Nota siguiente"}
      style={{
        width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.border}`,
        background: C.card, color: disabled ? C.textDim : C.text,
        fontFamily: font, fontSize: 18, fontWeight: 700, lineHeight: 1, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
        flexShrink: 0, transition: "opacity 0.15s",
      }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

export default function StickyNotesProfileWidget({ isDesktop }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [originOffset, setOriginOffset] = useState({ x: 0, y: 0 });
  const [pendingDelete, setPendingDelete] = useState(null);

  const chipElRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchStickyNotes().then(data => {
      if (cancelled) return;
      setNotes(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const getGridOffset = useCallback(() => {
    const el = chipElRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2) - window.innerWidth / 2,
      y: (rect.top + rect.height / 2) - window.innerHeight / 2,
    };
  }, []);

  const openNote = useCallback(() => {
    setOriginOffset(getGridOffset() || { x: 0, y: 0 });
    setIsOpen(true);
  }, [getGridOffset]);

  const handleNoteUpdated = useCallback((updated) => {
    setNotes(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);

  const handleClosed = useCallback(() => setIsOpen(false), []);

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    if (notes[index]?.id === target.id) setIsOpen(false);
    setNotes(prev => {
      const next = prev.filter(n => n.id !== target.id);
      setIndex(i => Math.min(i, Math.max(next.length - 1, 0)));
      return next;
    });
    const ok = await deleteStickyNote(target.id);
    if (!ok) fetchStickyNotes().then(setNotes); // roll back on failure, same as the Tool page
  }, [pendingDelete, notes, index]);

  // Nothing to show and nothing pending — don't render an empty/broken
  // carousel with a "0 / 0" counter and dead arrows.
  if (!loading && notes.length === 0) return null;

  return (
    <div style={{ padding: "22px 18px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>
          Sticky Notes
        </h3>
        {!loading && notes.length > 0 && (
          <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: C.textMuted }}>
            {index + 1} / {notes.length}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ width: "min(200px, 46vw)", aspectRatio: "1 / 1", margin: "0 auto", borderRadius: 4, background: C.card, border: `1px solid ${C.border}`, opacity: 0.4 }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ArrowBtn dir="prev" disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i - 1))} />
          <div style={{ width: "min(200px, 46vw)", flexShrink: 0 }}>
            <StickyNoteChip
              note={notes[index]}
              hidden={isOpen}
              gridRef={(el) => { chipElRef.current = el; }}
              onOpen={openNote}
            />
          </div>
          <ArrowBtn dir="next" disabled={index === notes.length - 1} onClick={() => setIndex(i => Math.min(notes.length - 1, i + 1))} />
        </div>
      )}

      {isOpen && notes[index] && (
        <StickyNoteExpanded
          notes={notes}
          index={index}
          setIndex={setIndex}
          originOffset={originOffset}
          getGridOffset={getGridOffset}
          onNoteUpdated={handleNoteUpdated}
          onDeleteRequest={setPendingDelete}
          onClosed={handleClosed}
          startInEditMode={false}
          isDesktop={isDesktop}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar esta nota?"
        subtitle={pendingDelete?.title ? `"${pendingDelete.title}" se eliminará permanentemente.` : "Esta acción no se puede deshacer."}
        confirmLabel="Eliminar"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
