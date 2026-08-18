/**
 * StickyNotesPage.jsx
 *
 * Sticky Notes — a personal library of reusable notes, styled and animated
 * to actually feel like sticky notes rather than a generic card CRUD.
 * Dropped into ToolPortal exactly like RiskCalculatorPage (see that file);
 * the portal mechanism itself is untouched.
 *
 * This file owns:
 *  - the 2-column grid of StickyNoteChip (small, tilted, paper-colored),
 *  - which note (if any) is expanded, and the on-screen rect math needed to
 *    grow/shrink the expanded note to/from its exact grid slot,
 *  - creating a note (spawns blank + opens directly into edit mode — no
 *    separate composer anymore) and the delete confirmation.
 *
 * StickyNoteExpanded owns everything about the enlarged note itself:
 * paging between notes, inline editing, autosave, and the color picker.
 * See that file's header for how the grow/shrink and paging animations are
 * split apart.
 *
 * Still independent of Checklist (no shared components/hooks/API — see
 * lib/stickyNotesApi.js's header) and still doesn't implement anything
 * about Profile; that integration point is fetchStickyNote(id) in the API
 * file, unused until Profile exists.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, StickyNote as StickyNoteIcon } from "lucide-react";
import { PageContainer } from "../../lib/layout.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StickyNoteChip from "./StickyNoteChip.jsx";
import StickyNoteExpanded from "./StickyNoteExpanded.jsx";
import { DEFAULT_STICKY_COLOR } from "./stickyNoteColors.js";
import {
  fetchStickyNotes,
  createStickyNote,
  deleteStickyNote,
} from "../../lib/stickyNotesApi.js";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#000000", card: "#121212", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#4a4a5e", gold: "#d4a843",
};

export default function StickyNotesPage({ isDesktop }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedIndex, setExpandedIndex] = useState(null); // null = grid view
  const [originOffset, setOriginOffset] = useState({ x: 0, y: 0 });
  const [autoEditId, setAutoEditId] = useState(null); // note id to open straight into edit mode (new notes)

  const [pendingDelete, setPendingDelete] = useState(null);

  const gridRefsMap = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    fetchStickyNotes().then(data => {
      if (cancelled) return;
      setNotes(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Live rect → viewport-center-relative offset for whichever note's chip
  // is asked for, used both to open (tapped note) and to close (currently
  // shown note, which may differ if the user paged since opening).
  const getGridOffset = useCallback((noteId) => {
    const el = gridRefsMap.current.get(noteId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2) - window.innerWidth / 2,
      y: (rect.top + rect.height / 2) - window.innerHeight / 2,
    };
  }, []);

  const openAt = useCallback((idx, { autoEdit = false, offset } = {}) => {
    const note = notes[idx];
    setOriginOffset(offset ?? getGridOffset(note.id) ?? { x: 0, y: 0 });
    setAutoEditId(autoEdit ? note.id : null);
    setExpandedIndex(idx);
  }, [notes, getGridOffset]);

  const handleCreate = useCallback(async () => {
    const created = await createStickyNote({ title: "", content: "", color: DEFAULT_STICKY_COLOR });
    if (!created) return;
    setNotes(prev => {
      const next = [created, ...prev];
      // Open it once it's actually in state (next tick), growing from the
      // center — there's no existing grid slot to fly from for a note that
      // didn't exist a moment ago.
      requestAnimationFrame(() => openAt(0, { autoEdit: true, offset: { x: 0, y: 0 } }));
      return next;
    });
  }, [openAt]);

  const handleNoteUpdated = useCallback((updated) => {
    setNotes(prev => prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n)));
  }, []);

  const handleClosed = useCallback(() => {
    setExpandedIndex(null);
    setAutoEditId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    // If the note being deleted is the one currently expanded, close the
    // viewer first so it doesn't sit open pointing at a note that no
    // longer exists.
    if (expandedIndex !== null && notes[expandedIndex]?.id === target.id) {
      setExpandedIndex(null);
      setAutoEditId(null);
    }
    setNotes(prev => prev.filter(n => n.id !== target.id)); // optimistic
    const ok = await deleteStickyNote(target.id);
    if (!ok) fetchStickyNotes().then(setNotes); // roll back on failure
  }, [pendingDelete, expandedIndex, notes]);

  const gridMaxWidth = 380; // keeps notes small/note-sized even in the wider desktop workspace column

  return (
    <PageContainer isDesktop={isDesktop} variant="workspace">
      <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, maxWidth: gridMaxWidth, marginLeft: "auto", marginRight: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StickyNoteIcon size={isDesktop ? 22 : 18} color={C.gold} strokeWidth={2} />
            <div>
              <h1 style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 22 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
                Sticky Notes
              </h1>
              {isDesktop && (
                <p style={{ margin: "3px 0 0", fontFamily: font, fontSize: 12.5, color: C.textMuted }}>
                  Tu colección de notas adhesivas
                </p>
              )}
            </div>
          </div>
          <button onClick={handleCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, background: C.gold, border: "none", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.5} /> Nueva
          </button>
        </div>

        {/* 2-column grid */}
        {loading ? (
          <div style={{ maxWidth: gridMaxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: 4, background: C.card, border: `1px solid ${C.border}`, opacity: 0.4 }} />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div style={{ maxWidth: gridMaxWidth, margin: "0 auto", minHeight: 200, borderRadius: 16, border: `1px dashed ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
            <StickyNoteIcon size={26} color={C.textDim} strokeWidth={1.6} />
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, textAlign: "center" }}>
              Aún no tienes notas guardadas.
            </p>
            <button onClick={handleCreate}
              style={{ padding: "8px 16px", borderRadius: 10, background: "transparent", border: `1px solid ${C.gold}55`, color: C.gold, fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Crear la primera
            </button>
          </div>
        ) : (
          <div style={{ maxWidth: gridMaxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {notes.map((note, idx) => (
              <StickyNoteChip
                key={note.id}
                note={note}
                hidden={expandedIndex !== null && notes[expandedIndex]?.id === note.id}
                gridRef={(el) => {
                  if (el) gridRefsMap.current.set(note.id, el);
                  else gridRefsMap.current.delete(note.id);
                }}
                onOpen={() => openAt(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {expandedIndex !== null && notes[expandedIndex] && (
        <StickyNoteExpanded
          notes={notes}
          index={expandedIndex}
          setIndex={setExpandedIndex}
          originOffset={originOffset}
          getGridOffset={getGridOffset}
          onNoteUpdated={handleNoteUpdated}
          onDeleteRequest={setPendingDelete}
          onClosed={handleClosed}
          startInEditMode={autoEditId === notes[expandedIndex].id}
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
    </PageContainer>
  );
}
