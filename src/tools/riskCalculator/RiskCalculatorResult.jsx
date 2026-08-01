/**
 * RiskCalculatorResult.jsx
 *
 * The single most important number in the whole tool — rendered with the
 * most visual weight in the widget on purpose. Purely presentational:
 * receives the already-computed lot/risk values and a copy handler, no
 * calculation happens in here.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { fmtLot, fmtMoney } from "./riskCalculatorService.js";

const font = "'DM Sans', sans-serif";
const C = {
  cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
  green: "#22c55e",
};

export default function RiskCalculatorResult({ lot, riskDollar, accentColor }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fmtLot(lot));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can fail (permissions, insecure context) — fail silently,
      // nothing else in the UI depends on the copy having succeeded.
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
      <div>
        <p style={{ margin: "0 0 2px", fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>LOT</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: font, fontSize: 34, fontWeight: 800, color: accentColor, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {fmtLot(lot)}
          </span>
          <button onClick={handleCopy}
            style={{ width: 30, height: 30, borderRadius: 9, background: C.cardHover, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: copied ? C.green : C.textMuted, flexShrink: 0 }}>
            {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
          </button>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ margin: "0 0 2px", fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>RIESGO</p>
        <span style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.green }}>{fmtMoney(riskDollar)}</span>
      </div>
    </div>
  );
}
