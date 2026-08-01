/**
 * RiskCalculatorChipRow.jsx
 *
 * Purely presentational — receives the chip values to show (from
 * riskCalculatorService.generateGroupChips — real lot-group representatives,
 * memoized by the widget against instrument/balance/risk) and the currently
 * active SL, renders them, and calls onSelect(value) on tap. Doesn't know or
 * care how the values were generated — that logic lives entirely in the
 * service, not here.
 */
const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", border: "#1c1c2e", textMuted: "#8e8e8e",
};

// Group representatives can land on any cent value (148.77, not just a
// round .00/.50), so every chip is shown at the same 2-decimal precision as
// the SL field itself — consistent, and never misleadingly rounds off the
// exact boundary the chip actually jumps to.
export default function RiskCalculatorChipRow({ values, activeValue, accentColor, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
      {values.map((v) => {
        // Tolerance compare — floats from typed/stepped input can differ
        // from a group value by fractions of a cent. Only lights up when
        // the current SL sits exactly on this chip's representative (i.e.
        // after navigating there), not merely somewhere inside its group.
        const active = Math.abs((Number(activeValue) || 0) - v) < 0.001;
        return (
          <button
            key={v}
            onClick={() => onSelect(v)}
            style={{
              flexShrink: 0, minWidth: 48, padding: "6px 10px", borderRadius: 9,
              fontFamily: font, fontSize: 12.5, fontWeight: 700,
              background: active ? accentColor : C.card,
              border: `1px solid ${active ? accentColor : C.border}`,
              color: active ? "#fff" : C.textMuted,
              cursor: "pointer", transition: "background 0.12s, border-color 0.12s",
            }}>
            {v.toFixed(2)}
          </button>
        );
      })}
    </div>
  );
}
