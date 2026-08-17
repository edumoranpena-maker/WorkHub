/**
 * StickyNotesPage.jsx
 *
 * Sticky Notes — a personal library of reusable notes. This is the whole
 * Tool: Tools.jsx just drops this component into ToolPortal's body exactly
 * like RiskCalculatorPage (see tools/riskCalculator/RiskCalculatorPage.jsx),
 * the same "the grid/portal mechanism doesn't know anything about what's
 * inside" split RiskCalculator already established.
 *
 * Deliberately independent of Checklist: no shared components, hooks, or
 * API file. See lib/stickyNotesApi.js's header for why, and
 * ConfirmDialog.jsx / RiskCalculatorPage.jsx for which existing, stable
 * pieces this *does* build on instead.
 *
 * Scope of this pass (per spec): create / edit / delete / list a note,
 * persisted to Supabase. Profile doesn't exist yet, so there is no
 * "use this note as a widget" action here — only fetchStickyNote(id) in
 * stickyNotesApi.js is prepared for that, unused until Profile is built.
 */
import { useState, useEffect, useCallback } from "react";
import { Plus, StickyNote as StickyNoteIcon } from "lucide-react";
import { PageContainer } from "../../lib/layout.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import StickyNoteCard from "./StickyNoteCard.jsx";
import StickyNoteEditorModal from "./StickyNoteEditorModal.jsx";
import {
  fetchStickyNotes,
  createStickyNote,
  updateStickyNote,
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // null = creating
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // note being confirmed for deletion

  useEffect(() => {
    let cancelled = false;
    fetchStickyNotes().then(data => {
      if (cancelled) return;
      setNotes(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const openCreate = useCallback(() => { setEditingNote(null); setEditorOpen(true); }, []);
  const openEdit = useCallback((note) => { setEditingNote(note); setEditorOpen(true); }, []);
  const closeEditor = useCallback(() => { if (!saving) setEditorOpen(false); }, [saving]);

  const handleSave = useCallback(async ({ title, content }) => {
    setSaving(true);
    if (editingNote) {
      const updated = await updateStickyNote(editingNote.id, { title, content });
      if (updated) setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    } else {
      const created = await createStickyNote({ title, content });
      if (created) setNotes(prev => [created, ...prev]);
    }
    setSaving(false);
    setEditorOpen(false);
    setEditingNote(null);
  }, [editingNote]);

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    setNotes(prev => prev.filter(n => n.id !== target.id)); // optimistic
    const ok = await deleteStickyNote(target.id);
    if (!ok) {
      // Roll back on failure — re-fetch is simpler and safer here than
      // trying to re-insert the stale local object in the right order.
      fetchStickyNotes().then(setNotes);
    }
  }, [pendingDelete]);

  return (
    <PageContainer isDesktop={isDesktop} variant="workspace">
      <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>

        {/* Header — same shape as RiskCalculatorPage's own header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StickyNoteIcon size={isDesktop ? 22 : 18} color={C.gold} strokeWidth={2} />
            <div>
              <h1 style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 24 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
                Sticky Notes
              </h1>
              {isDesktop && (
                <p style={{ margin: "3px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted }}>
                  Tu biblioteca personal de notas reutilizables
                </p>
              )}
            </div>
          </div>
          <button onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: isDesktop ? "9px 14px" : "8px 12px", borderRadius: 10, background: C.gold, border: "none", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.5} /> {isDesktop && "Nueva nota"}
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr 1fr", gap: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ minHeight: 118, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, opacity: 0.5 }} />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div style={{ minHeight: 220, borderRadius: 16, border: `1px dashed ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
            <StickyNoteIcon size={26} color={C.textDim} strokeWidth={1.6} />
            <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted, textAlign: "center" }}>
              Aún no tienes notas guardadas.
            </p>
            <button onClick={openCreate}
              style={{ padding: "8px 16px", borderRadius: 10, background: "transparent", border: `1px solid ${C.gold}55`, color: C.gold, fontFamily: font, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Crear la primera
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr 1fr", gap: 12 }}>
            {notes.map(note => (
              <StickyNoteCard
                key={note.id}
                note={note}
                onOpen={() => openEdit(note)}
                onDelete={() => setPendingDelete(note)}
              />
            ))}
          </div>
        )}
      </div>

      <StickyNoteEditorModal
        open={editorOpen}
        note={editingNote}
        saving={saving}
        onSave={handleSave}
        onClose={closeEditor}
      />

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
