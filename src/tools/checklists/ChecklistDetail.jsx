/**
 * ChecklistDetail.jsx
 *
 * View/execute mode for a single checklist. Progress (which steps are
 * checked) is PURE local component state — intentionally never persisted
 * anywhere (see checklistsApi.js's header comment): closing this screen and
 * reopening the checklist always starts at 0/N. The checklist itself
 * (name/description/steps/media) is what survives a refresh, not the
 * execution state — that split is the whole point of this phase.
 */
import { useState } from "react";
import { CheckCircle2, Circle, Pencil, Trash2, Image as ImageIcon, PlayCircle } from "lucide-react";
import { useImageViewer } from "../../components/GlobalImageViewer.jsx";
import ProgressDots from "./ProgressDots.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", surface: "#0a0a0a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843", green: "#22c55e", red: "#ef4444",
};

function MediaStrip({ media, onOpen }) {
  if (!media?.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
      {media.map((m, i) => (
        <div key={m.id || i} onClick={() => onOpen(media, i)}
          style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, cursor: "pointer", flexShrink: 0 }}>
          {m.type === "video" ? (
            <video src={m.url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChecklistDetail({ checklist, isDesktop, onBack, onEdit, onDelete }) {
  const [checked, setChecked] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { openGallery, ViewerPortal } = useImageViewer();

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

      {checklist.media?.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <ImageIcon size={12} color={C.textMuted} />
            <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Media general</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {checklist.media.map((m, i) => (
              <div key={m.id || i} onClick={() => openGallery({ items: checklist.media, startIndex: i })}
                style={{ width: 84, height: 84, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, cursor: "pointer", flexShrink: 0, position: "relative" }}>
                {m.type === "video" ? (
                  <>
                    <video src={m.url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                      <PlayCircle size={20} color="#fff" />
                    </div>
                  </>
                ) : (
                  <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", borderRadius: 14, border: `1px dashed ${C.border}` }}>
          <p style={{ margin: 0, fontFamily: font, fontSize: 13, color: C.textMuted }}>Este checklist todavía no tiene pasos.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {checklist.items.map((item, i) => {
              const isChecked = checked.has(item.id);
              return (
                <div key={item.id}
                  style={{ padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${isChecked ? C.gold + "40" : C.border}`, transition: "border-color 0.2s" }}>
                  <button onClick={() => toggleStep(i)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    {isChecked ? <CheckCircle2 size={19} color={C.gold} fill={`${C.gold}22`} /> : <Circle size={19} color={C.textDim} />}
                    <span style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: isChecked ? C.text : C.text, textDecoration: isChecked ? "line-through" : "none", opacity: isChecked ? 0.75 : 1 }}>
                      {item.label}
                    </span>
                  </button>
                  <MediaStrip media={item.media} onOpen={(media, idx) => openGallery({ items: media, startIndex: idx })} />
                </div>
              );
            })}
          </div>

          <div style={{ padding: "20px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, marginBottom: allDone && checklist.completionMessage ? 14 : 0 }}>
            <ProgressDots total={total} completed={completedCount} accent={C.gold} trackColor={C.border} />
          </div>

          {allDone && checklist.completionMessage && (
            <div style={{ padding: "16px 18px", borderRadius: 14, background: `${C.gold}12`, border: `1px solid ${C.gold}35`, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <CheckCircle2 size={18} color={C.gold} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontFamily: font, fontSize: 13.5, color: C.text, lineHeight: 1.55, fontWeight: 600 }}>
                {checklist.completionMessage}
              </p>
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10050, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", padding: 20 }}
          onClick={() => setConfirmDelete(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 340, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>¿Eliminar este checklist?</p>
            <p style={{ margin: "0 0 18px", fontFamily: font, fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
              Se eliminará "{checklist.name}" y todos sus pasos y media. Esta acción no se puede deshacer.
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

      <ViewerPortal />
    </div>
  );
}
