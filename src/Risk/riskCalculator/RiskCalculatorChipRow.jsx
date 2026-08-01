/**
 * RiskCalculatorChipRow.jsx
 *
 * Purely presentational — receives the chip values to show (from
 * riskCalculatorService.getSlChips) and the currently active SL, renders
 * them, and calls onSelect(value) on tap. Doesn't know or care whether the
 * values came from the static config or (later) from learned history —
 * that decision lives entirely in the service, not here.
 */
const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", border: "#1c1c2e", textMuted: "#8e8e8e",
};

export default function RiskCalculatorChipRow({ values, activeValue, accentColor, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
      {values.map((v) => {
        const active = Number(activeValue) === v;
        return (
          <button
            key={v}
            onClick={() => onSelect(v)}
            style={{
              flexShrink: 0, minWidth: 40, padding: "6px 10px", borderRadius: 9,
              fontFamily: font, fontSize: 12.5, fontWeight: 700,
              background: active ? accentColor : C.card,
              border: `1px solid ${active ? accentColor : C.border}`,
              color: active ? "#fff" : C.textMuted,
              cursor: "pointer", transition: "background 0.12s, border-color 0.12s",
            }}>
            {v}
          </button>
        );
      })}
    </div>
  );
}
