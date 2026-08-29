/**
 * ChecklistEditor.jsx
 *
 * One component, two modes:
 *   - mode="create": everything staged locally (name/description/steps),
 *     nothing touches Supabase until the final "Crear Checklist" button —
 *     exactly like PostComposer.
 *   - mode="edit": `checklistId` + `initial` (the already-fetched checklist)
 *     are provided. Every structural action (add/edit/delete/reorder a
 *     step) calls checklistsApi immediately — see that file's header
 *     comment for why this is immediate instead of a batched diff. Only
 *     name/description/completion message are staged locally, committed by
 *     the explicit "Guardar" button.
 *
 * Step reordering uses framer-motion's Reorder.Group/Reorder.Item — no new
 * drag & drop dependency, framer-motion is already used everywhere else in
 * this app (Post.jsx, GlobalImageViewer.jsx, Tools.jsx's own portal).
 *
 * NOTE: media/reference attachments (general + per-step) were removed from
 * this editor — a checklist's real reference is now the Posts where it was
 * actually used (see ChecklistDetail.jsx's own "POST" section). The
 * underlying checklist_media/checklist_item_media tables and their
 * checklistsApi.js functions (addChecklistMedia, removeChecklistItemMedia,
 * etc.) were deliberately left in place rather than deleted — they're
 * unused now but removing live schema/data wasn't part of this change, and
 * leaving unused, harmless functions in the API file is safer than
 * touching Supabase for something not explicitly asked for.
 */
import { useState, useRef, useCallback, memo } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Trash2, Plus } from "lucide-react";
import {
  addChecklistItem, updateChecklistItemLabel, deleteChecklistItem, reorderChecklistItems,
} from "../../lib/checklistsApi.js";
import { dlog, useRenderLog, useMountLog } from "./_debug.js"; // [CHECKLIST-DEBUG] temporary — see file header

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", surface: "#0a0a0a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843", red: "#ef4444",
};

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, background: C.surface,
  border: `1px solid ${C.border}`, color: C.text, fontFamily: font, fontSize: 13.5,
  outline: "none", boxSizing: "border-box",
};
const labelStyle = { display: "block", margin: "0 0 6px", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" };

let localIdSeq = 0;
const nextLocalId = () => `local-${Date.now()}-${localIdSeq++}`;

// ─── StepRow — one step: label + drag handle + delete. No media zone. ──────
// React.memo'd: with N steps, typing in one step's label used to re-render
// every OTHER step's row too on every keystroke. The parent passes stable
// callback references (useCallback below) so this memoization is actually
// effective — memo alone does nothing if the props change identity every
// render.
const StepRow = memo(function StepRow({ item, onLabelChange, onLabelCommit, onDelete }) {
  useRenderLog(`StepRow[${item.id}]`); // [CHECKLIST-DEBUG]
  useMountLog(`StepRow[${item.id}]`); // [CHECKLIST-DEBUG]
  const controls = useDragControls();

  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8, listStyle: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 10px 6px" }}>
        <div onPointerDown={(e) => controls.start(e)}
          style={{ cursor: "grab", touchAction: "none", color: C.textDim, display: "flex", padding: 4, flexShrink: 0 }}>
          <GripVertical size={16} />
        </div>
        <input
          value={item.label}
          onChange={e => onLabelChange(item.id, e.target.value)}
          onBlur={() => onLabelCommit(item.id)}
          placeholder="Nombre del paso"
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: font, fontSize: 13.5, fontWeight: 600, padding: "4px 0" }}
        />
        <button onClick={() => onDelete(item.id)} title="Eliminar paso"
          style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: C.textDim, display: "flex", flexShrink: 0 }}>
          <Trash2 size={14} />
        </button>
      </div>
    </Reorder.Item>
  );
});

export default function ChecklistEditor({ mode, checklistId, initial, onCreate, onExitEdit, isDesktop }) {
  useRenderLog(`ChecklistEditor[mode=${mode}]`); // [CHECKLIST-DEBUG]
  useMountLog(`ChecklistEditor[mode=${mode}, checklistId=${checklistId}]`); // [CHECKLIST-DEBUG]
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [completionMessage, setCompletionMessage] = useState(initial?.completionMessage || "");
  const [items, setItems] = useState(() => initial?.items || []);
  const [newStepLabel, setNewStepLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Read by onLabelCommit below without needing `items` in its own
  // useCallback deps (which would defeat the memoization — a new
  // onLabelCommit on every keystroke, in every step, is exactly the
  // per-render-recreation the audit flagged). Kept in sync every render;
  // this is just a plain assignment, not an effect — cheap and safe.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ── Steps ──────────────────────────────────────────────────────────────
  const addStep = async () => {
    const label = newStepLabel.trim();
    if (!label) return;
    setNewStepLabel("");
    if (isEdit) {
      const item = await addChecklistItem(checklistId, label);
      if (item) setItems(prev => [...prev, item]);
    } else {
      setItems(prev => [...prev, { id: nextLocalId(), label }]);
    }
  };

  // Every one of these is passed straight down to StepRow — stable
  // references (empty deps, or deps that only change once per component
  // lifetime like isEdit) so StepRow's React.memo can actually skip
  // re-rendering rows the user isn't touching.
  const onLabelChange = useCallback((id, label) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, label } : it));
  }, []);

  const onLabelCommit = useCallback(async (id) => {
    if (!isEdit) return;
    const item = itemsRef.current.find(it => it.id === id);
    if (item) await updateChecklistItemLabel(id, item.label);
  }, [isEdit]);

  const onDeleteStep = useCallback(async (id) => {
    if (isEdit) await deleteChecklistItem(id);
    setItems(prev => prev.filter(it => it.id !== id));
  }, [isEdit]);

  const onReorder = async (nextOrder) => {
    setItems(nextOrder);
    if (isEdit) await reorderChecklistItems(nextOrder.map(it => it.id));
  };

  // ── Submit (create) / Guardar (edit fields) ──────────────────────────────
  const canSubmit = name.trim().length > 0 && !saving;

  const handleCreate = async () => {
    if (!canSubmit) return;
    dlog("handleCreate() -> onCreate()"); // [CHECKLIST-DEBUG]
    setSaving(true);
    await onCreate({
      name: name.trim(),
      description: description.trim(),
      completionMessage: completionMessage.trim(),
      items: items.map(it => ({ label: it.label })),
    });
    setSaving(false);
  };

  const handleSaveFields = async () => {
    if (!canSubmit) return;
    dlog("handleSaveFields() -> onExitEdit()", { name, description, completionMessage }); // [CHECKLIST-DEBUG]
    setSaving(true);
    await onExitEdit({ name: name.trim(), description: description.trim(), completionMessage: completionMessage.trim() });
    setSaving(false);
  };

  return (
    <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Nombre</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Execution Checklist" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Descripción (opcional)</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Condiciones que debo confirmar antes y durante una ejecución."
          rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.5 }} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Pasos</label>
        <Reorder.Group axis="y" values={items} onReorder={onReorder} style={{ margin: 0, padding: 0 }}>
          {items.map(item => (
            <StepRow key={item.id} item={item}
              onLabelChange={onLabelChange} onLabelCommit={onLabelCommit} onDelete={onDeleteStep} />
          ))}
        </Reorder.Group>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input
            value={newStepLabel}
            onChange={e => setNewStepLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }}
            placeholder="Agregar paso…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addStep} disabled={!newStepLabel.trim()}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 16px", borderRadius: 10, background: newStepLabel.trim() ? C.gold : C.card, border: `1px solid ${newStepLabel.trim() ? C.gold : C.border}`, color: newStepLabel.trim() ? "#000" : C.textDim, fontFamily: font, fontSize: 13, fontWeight: 700, cursor: newStepLabel.trim() ? "pointer" : "default", flexShrink: 0 }}>
            <Plus size={15} strokeWidth={2.4} /> Agregar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Mensaje de completado (opcional)</label>
        <textarea value={completionMessage} onChange={e => setCompletionMessage(e.target.value)} placeholder="Checklist completado. Ahora deja que la operación se desarrolle según el plan."
          rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.5 }} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {isEdit ? (
          <>
            <button onClick={() => onExitEdit(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: font, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={handleSaveFields} disabled={!canSubmit}
              style={{ flex: 2, padding: "12px 0", borderRadius: 12, background: canSubmit ? `linear-gradient(135deg, ${C.gold}, #b8862f)` : C.card, border: "none", color: canSubmit ? "#000" : C.textDim, fontFamily: font, fontSize: 14, fontWeight: 800, cursor: canSubmit ? "pointer" : "default" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </>
        ) : (
          <button onClick={handleCreate} disabled={!canSubmit}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: canSubmit ? `linear-gradient(135deg, ${C.gold}, #b8862f)` : C.card, border: "none", color: canSubmit ? "#000" : C.textDim, fontFamily: font, fontSize: 14.5, fontWeight: 800, cursor: canSubmit ? "pointer" : "default" }}>
            {saving ? "Creando…" : "Crear Checklist"}
          </button>
        )}
      </div>
    </div>
  );
}
