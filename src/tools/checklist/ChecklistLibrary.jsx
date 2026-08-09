/**
 * ChecklistLibrary.jsx
 *
 * The Checklist Tool's home screen — "ver mis checklists" + "crear
 * checklist". Compact cards, same visual language as Tools.jsx's own grid
 * (card/border/gold-accent tokens copied from there on purpose, so this
 * reads as a native extension of Tools rather than a different app).
 */
import { CheckSquare, Plus, ListChecks } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843",
};

function ChecklistCard({ checklist, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: 10, textAlign: "left",
        padding: "14px 14px 12px", borderRadius: 14,
        background: C.card, border: `1px solid ${C.border}`, cursor: "pointer",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${C.gold}18`, border: `1px solid ${C.gold}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckSquare size={15} color={C.gold} strokeWidth={2} />
        </div>
        <span style={{ fontFamily: font, fontSize: 10.5, fontWeight: 700, color: C.textMuted, background: "#0a0a0a", border: `1px solid ${C.border}`, borderRadius: 99, padding: "3px 8px" }}>
          {checklist.itemCount} {checklist.itemCount === 1 ? "paso" : "pasos"}
        </span>
      </div>
      <div>
        <p style={{ margin: "0 0 3px", fontFamily: font, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {checklist.name}
        </p>
        {checklist.description && (
          <p style={{ margin: 0, fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {checklist.description}
          </p>
        )}
      </div>
    </button>
  );
}

export default function ChecklistLibrary({ checklists, loading, isDesktop, onOpenChecklist, onCreateNew }) {
  return (
    <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ListChecks size={isDesktop ? 22 : 18} color={C.gold} strokeWidth={2} />
          <div>
            <h1 style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 24 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
              Checklists
            </h1>
            {isDesktop && (
              <p style={{ margin: "3px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted }}>
                Listas reutilizables de confirmación para tu operativa
              </p>
            )}
          </div>
        </div>
        <button onClick={onCreateNew}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: isDesktop ? "9px 14px" : "8px 12px", borderRadius: 10, background: `linear-gradient(135deg, ${C.gold}, #b8862f)`, border: "none", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <Plus size={15} strokeWidth={2.4} /> {isDesktop ? "Crear Checklist" : "Crear"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
          <span style={{ fontFamily: font, fontSize: 13, color: C.textDim }}>Cargando…</span>
        </div>
      ) : checklists.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 20px", borderRadius: 16, border: `1px dashed ${C.border}` }}>
          <ListChecks size={28} color={C.textDim} strokeWidth={1.5} />
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 14, fontWeight: 700, color: C.text }}>Todavía no tenés checklists</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 12.5, color: C.textMuted }}>Creá el primero para empezar a usarlo en tu operativa.</p>
          </div>
          <button onClick={onCreateNew}
            style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, padding: "9px 16px", borderRadius: 10, background: `linear-gradient(135deg, ${C.gold}, #b8862f)`, border: "none", color: "#000", fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={15} strokeWidth={2.4} /> Crear Checklist
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(200px, 1fr))" : "1fr 1fr", gap: 12 }}>
          {checklists.map(c => (
            <ChecklistCard key={c.id} checklist={c} onClick={() => onOpenChecklist(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
