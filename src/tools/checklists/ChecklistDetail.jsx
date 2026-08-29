/**
 * ChecklistDetail.jsx
 *
 * View/execute mode for a single checklist. Progress (which steps are
 * checked) is PURE local component state — intentionally never persisted
 * anywhere (see checklistsApi.js's header comment): closing this screen and
 * reopening the checklist always starts at 0/N. The checklist itself
 * (name/description/steps) is what survives a refresh, not the execution
 * state — that split is the whole point of this phase. (This is
 * deliberately different from Thread → Checklist's own executions, which
 * DO persist progress — see ThreadChecklistTab in Post.jsx and
 * checklistExecutionsApi.js. This screen is the checklist's DEFINITION and
 * a scratch-pad preview of it, not an execution.)
 *
 * Media/reference attachments were removed from this checklist entirely —
 * see the "POST" section at the bottom instead: the real reference for a
 * checklist is now the actual Posts where it was used, not manually
 * attached images.
 *
 * Same visual language (checkbox style, ProgressDots, completion box) is
 * shared with Post.jsx's ThreadChecklistTab, including the new
 * green-on-fully-complete treatment — see the shared color logic in both
 * files' headers.
 */
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Pencil, Trash2, FileText } from "lucide-react";
import ProgressDots from "./ProgressDots.jsx";
import { fetchPostsForChecklist } from "../../lib/checklistExecutionsApi.js";
import { useNavigation } from "../../lib/navigation.jsx";
import { useRenderLog, useMountLog } from "./_debug.js"; // [CHECKLIST-DEBUG] temporary — see file header

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", surface: "#0a0a0a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843", green: "#22c55e", red: "#ef4444",
};

// ─── POST section — real Posts where this checklist was actually used ─────
// Not a copy, not a manual reference: fetchPostsForChecklist reads real
// checklist_executions rows joined to recap_threads. Clicking a row
// navigates to the real Post via the app's own navigation (useNavigation),
// which also closes this Tools portal automatically (openToolId derives
// from the route, same mechanism Registrar already relies on) — no
// parallel "open a copy" view.
function ChecklistPostsSection({ checklistId }) {
  const { navigate } = useNavigation();
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPostsForChecklist(checklistId).then(rows => {
      if (!cancelled) { setPosts(rows); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [checklistId]);

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <FileText size={12} color={C.textMuted} />
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Post</span>
      </div>

      {posts.length === 0 ? (
        <p style={{ margin: 0, fontFamily: font, fontSize: 12.5, color: C.textDim, fontStyle: "italic" }}>
          Este checklist todavía no se ha usado en ningún Post.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map(p => (
            <div key={p.id} onClick={() => navigate("thread", { threadId: p.id })}
              style={{ padding: "11px 13px", borderRadius: 11, background: C.card, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChecklistDetail({ checklist, isDesktop, onBack, onEdit, onDelete }) {
  useRenderLog(`ChecklistDetail[${checklist.id}]`); // [CHECKLIST-DEBUG]
  useMountLog(`ChecklistDetail[${checklist.id}] "${checklist.name}"`); // [CHECKLIST-DEBUG]
  const [checked, setChecked] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const total = checklist.items.length;
  const completedCount = checklist.items.filter(it => checked.has(it.id)).length;
  const allDone = total > 0 && completedCount === total;

  // Steps must be confirmed in order — checking step N auto-implies every
  // step before it stays checked (and unchecking one clears everything
  // after it). This is what keeps ProgressDots' "N completed = first N
  // dots filled" assumption true, matching the checklist's own nature (a
  // sequence of conditions to confirm in order, not an arbitrary to-do list).
  const toggleStep = (index) => {
    const item = checklist.items[index];
    setChecked(prev => {
      const next = new Set(prev);
      const willCheck = !next.has(item.id);
      if (willCheck) {
        for (let i = 0; i <= index; i++) next.add(checklist.items[i].id);
      } else {
        for (let i = index; i < checklist.items.length; i++) next.delete(checklist.items[i].id);
      }
      return next;
    });
  };

  return (
    <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 22 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
            {checklist.name}
          </h1>
          {checklist.description && (
            <p style={{ margin: "6px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
              {checklist.description}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} title="Editar"
            style={{ width: 32, height: 32, borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, cursor: "pointer" }}>
            <Pencil size={14} />
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Eliminar"
            style={{ width: 32, height: 32, borderRadius: 9, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.red, cursor: "pointer" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", borderRadius: 14, border: `1px dashed ${C.border}` }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted }}>Este checklist todavía no tiene pasos.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {checklist.items.map((item, i) => {
              const isChecked = checked.has(item.id);
              // Green only once EVERY step is done — an individually-checked
              // step while others remain pending keeps the existing gold
              // treatment (see this file's header: "no convertir todo el
              // componente en verde").
              const stepColor = isChecked ? (allDone ? C.green : C.gold) : null;
              return (
                <div key={item.id}
                  style={{ padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${isChecked ? stepColor + "40" : C.border}`, transition: "border-color 0.2s" }}>
                  <button onClick={() => toggleStep(i)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    {isChecked ? <CheckCircle2 size={19} color={stepColor} fill={`${stepColor}22`} /> : <Circle size={19} color={C.textDim} />}
                    <span style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: C.text, textDecoration: isChecked ? "line-through" : "none", opacity: isChecked ? 0.75 : 1 }}>
                      {item.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ padding: "20px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, marginBottom: allDone && checklist.completionMessage ? 14 : 0 }}>
            <ProgressDots total={total} completed={completedCount} accent={allDone ? C.green : C.gold} trackColor={C.border} />
          </div>

          {allDone && checklist.completionMessage && (
            <div style={{ padding: "16px 18px", borderRadius: 14, background: `${C.green}12`, border: `1px solid ${C.green}35`, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={18} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontFamily: font, fontSize: 13.5, color: C.text, lineHeight: 1.55, fontWeight: 600 }}>
                {checklist.completionMessage}
              </p>
            </div>
          )}
        </>
      )}

      <ChecklistPostsSection checklistId={checklist.id} />

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10050, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", padding: 20 }}
          onClick={() => setConfirmDelete(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>¿Eliminar este checklist?</p>
            <p style={{ margin: "0 0 18px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
              Se eliminará "{checklist.name}" y todos sus pasos. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: font, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => onDelete()}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: C.red, border: "none", color: "#fff", fontFamily: font, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
