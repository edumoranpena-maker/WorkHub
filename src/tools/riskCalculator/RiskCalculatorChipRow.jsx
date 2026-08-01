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

// If any chip in the row carries a decimal (e.g. the .50 presets), every
// chip in that row is shown with one decimal place so the row reads as a
// consistent scale (40, 50.5, 60, 70.5…) instead of a mix of "40" and
// "50.5" that looks like a formatting bug.
export default function RiskCalculatorChipRow({ values, activeValue, accentColor, onSelect }) {
  const hasDecimals = values.some(v => v % 1 !== 0);
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
      {values.map((v) => {
        // Tolerance compare — floats from typed/stepped input can differ
        // from a static config value by fractions of a cent.
        const active = Math.abs((Number(activeValue) || 0) - v) < 0.001;
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
            {hasDecimals ? v.toFixed(1) : v}
          </button>
        );
      })}
    </div>
  );
}
