/**
 * InstrumentSettingsCard.jsx
 *
 * Read-only summary of the instruments currently in use across the three
 * widgets — NOT an edit form. The gear button top-right is a visual
 * placeholder for a future edit Bottom Sheet; intentionally has no
 * onClick yet, per the brief ("por el momento ese botón no necesita hacer
 * nada").
 */
import { Settings } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
};

export default function InstrumentSettingsCard({ instruments }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Settings size={15} color={C.textMuted} strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontFamily: font, fontSize: 12.5, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>Instrument Settings</p>
            <p style={{ margin: "3px 0 0", fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              Los valores por punto pueden variar según el broker. Verifica y ajusta si es necesario.
            </p>
          </div>
        </div>
        {/* Placeholder for the future edit Bottom Sheet — no-op today */}
        <button
          style={{ width: 30, height: 30, borderRadius: 9, background: C.cardHover, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: C.textMuted }}>
          <Settings size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {instruments.map((instrument, i) => (
          <div key={instrument.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none",
            }}>
            <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{instrument.name}</span>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 1px", fontFamily: font, fontSize: 10, color: C.textMuted }}>Valor por punto</p>
              <p style={{ margin: 0, fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>${instrument.pointValue.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
