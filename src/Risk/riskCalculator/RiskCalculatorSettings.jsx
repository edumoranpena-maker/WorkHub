/**
 * RiskCalculatorSettings.jsx
 *
 * The "Configuración de cuenta" card. Balance and Risk% are the two
 * independent inputs; Risk$ is normally derived from them, but editing it
 * directly is also supported — in that case Risk% is recomputed to match,
 * keeping Balance fixed. That two-way sync lives in RiskCalculatorPage (the
 * owner of this state), not here — this component only renders three
 * fields and reports raw edits upward via the three onChange* callbacks.
 *
 * Header (icon + "CONFIGURACIÓN DE CUENTA") uses gold, not the instrument
 * colors used elsewhere in this feature — matches the rest of the ongoing
 * move away from the old purple branding.
 */
import { Settings } from "lucide-react";
import RiskCalculatorInput from "./RiskCalculatorInput.jsx";
import { fmtPercent, fmtMoney } from "./riskCalculatorService.js";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
  gold: "#d4a843", green: "#22c55e",
};

function Field({ label, valueDisplay, valueColor, children }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <p style={{ margin: "0 0 4px", fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ margin: "0 0 8px", fontFamily: font, fontSize: 20, fontWeight: 800, color: valueColor ?? C.text, letterSpacing: "-0.01em" }}>{valueDisplay}</p>
      {children}
    </div>
  );
}

export default function RiskCalculatorSettings({ balance, riskPercent, riskDollar, onBalanceChange, onRiskPercentChange, onRiskDollarChange }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
        <Settings size={14} color={C.gold} strokeWidth={2.2} />
        <span style={{ fontFamily: font, fontSize: 11, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Configuración de cuenta
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Field label="Balance" valueDisplay={fmtMoney(balance)}>
          <RiskCalculatorInput
            value={balance}
            onChange={onBalanceChange}
            step={100}
            decimals={0}
            prefix="$"
            showSteps={false}
          />
        </Field>

        <Field label="Riesgo (%)" valueDisplay={fmtPercent(riskPercent)} valueColor={C.green}>
          <RiskCalculatorInput
            value={riskPercent}
            onChange={onRiskPercentChange}
            step={0.1}
            decimals={2}
          />
        </Field>

        <Field label="Riesgo ($)" valueDisplay={fmtMoney(riskDollar)} valueColor={C.green}>
          <RiskCalculatorInput
            value={riskDollar}
            onChange={onRiskDollarChange}
            step={5}
            decimals={2}
            prefix="$"
            showSteps={false}
          />
        </Field>
      </div>
    </div>
  );
}
