/**
 * RiskCalculatorPage.jsx
 *
 * Owns every piece of state this tool needs and nothing else does:
 *   - Global account config (balance, riskPercent, riskDollar) — kept in
 *     two-way sync here (see the three handlers below) using the pure
 *     conversion functions from riskCalculatorService.js.
 *   - One state slot per widget ({ instrumentId, sl }) — an array, not
 *     three separate useState calls, specifically so a future persistence
 *     effect has one single value per concern to serialize instead of
 *     several scattered ones. See the persistence note near the bottom.
 *
 * Every visual component below (Settings, Widget, InstrumentSettingsCard)
 * is a controlled, presentational component — this file is the only place
 * that mutates state or calls into the service. That split is what
 * "separar completamente la lógica de negocio de la interfaz" means in
 * practice here.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { Calculator, HelpCircle } from "lucide-react";
import { PageContainer } from "../../lib/layout.jsx";
import { INSTRUMENTS, DEFAULT_WIDGET_INSTRUMENTS } from "./instrumentConfig.js";
import { riskDollarFromPercent, riskPercentFromDollar } from "./riskCalculatorService.js";
import RiskCalculatorSettings from "./RiskCalculatorSettings.jsx";
import RiskCalculatorWidget from "./RiskCalculatorWidget.jsx";
import InstrumentSettingsCard from "./InstrumentSettingsCard.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  bg: "#000000", card: "#121212", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e", textDim: "#32324a",
  gold: "#d4a843", green: "#22c55e",
};

// ─── useIsDesktop ───────────────────────────────────────────────────────────
// Local per-file copy, same convention as every other section/tool in the app.
function useIsDesktop() {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return v;
}

const DEFAULT_BALANCE = 5000;
const DEFAULT_RISK_PERCENT = 0.7;

export default function RiskCalculatorPage() {
  const isDesktop = useIsDesktop();

  // ── Global account config — balance/riskPercent are the two independent
  // inputs, riskDollar is real state too (not derived) so it can be edited
  // directly, but every handler below keeps all three consistent with each
  // other, matching the account's Balance. ──────────────────────────────────
  const [balance, setBalance] = useState(DEFAULT_BALANCE);
  const [riskPercent, setRiskPercent] = useState(DEFAULT_RISK_PERCENT);
  const [riskDollar, setRiskDollar] = useState(() => riskDollarFromPercent(DEFAULT_BALANCE, DEFAULT_RISK_PERCENT));

  const handleBalanceChange = useCallback((nextBalance) => {
    setBalance(nextBalance);
    setRiskDollar(riskDollarFromPercent(nextBalance, riskPercent));
  }, [riskPercent]);

  const handleRiskPercentChange = useCallback((nextPercent) => {
    setRiskPercent(nextPercent);
    setRiskDollar(riskDollarFromPercent(balance, nextPercent));
  }, [balance]);

  const handleRiskDollarChange = useCallback((nextDollar) => {
    setRiskDollar(nextDollar);
    setRiskPercent(riskPercentFromDollar(balance, nextDollar));
  }, [balance]);

  // ── Per-widget state — one array, one slot per widget. Each widget is
  // fully independent (spec: "todos funcionan de forma independiente") but
  // living in one array here is what lets a future persistence effect
  // watch/save all three from a single place instead of three separate ones.
  //
  // TODO (not implemented yet, by design): persist { balance, riskPercent,
  // riskDollar } and this `widgets` array (per-widget instrumentId + last SL
  // + last lot + last risk) — e.g. to localStorage or Supabase — behind a
  // single useEffect watching [balance, riskPercent, riskDollar, widgets].
  // Nothing about the components above needs to change when that effect is
  // added; they already only ever read/write through this state. ──────────
  const [widgets, setWidgets] = useState(() =>
    DEFAULT_WIDGET_INSTRUMENTS.map(id => ({
      instrumentId: id,
      sl: INSTRUMENTS[id].defaultSL,
    }))
  );

  const updateWidget = useCallback((index, nextState) => {
    setWidgets(prev => prev.map((w, i) => (i === index ? nextState : w)));
  }, []);

  // The three currently-selected instruments (deduped), for the summary
  // card below the widgets.
  const activeInstruments = useMemo(() => {
    const seen = new Set();
    return widgets
      .map(w => INSTRUMENTS[w.instrumentId])
      .filter(inst => (seen.has(inst.id) ? false : (seen.add(inst.id), true)));
  }, [widgets]);

  return (
    <PageContainer isDesktop={isDesktop} variant="workspace">
      <div style={{ padding: isDesktop ? "24px 0 40px" : "16px 14px 32px" }}>

        {/* Page header — icon in gold per the branding note; subtitle +
            "Guía rápida" are desktop-only, matching the reference (the
            mobile reference shows a simpler header). */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calculator size={isDesktop ? 22 : 18} color={C.gold} strokeWidth={2} />
            <div>
              <h1 style={{ margin: 0, fontFamily: font, fontSize: isDesktop ? 24 : 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
                Risk Calculator
              </h1>
              {isDesktop && (
                <p style={{ margin: "3px 0 0", fontFamily: font, fontSize: 13, color: C.textMuted }}>
                  Calcula tu tamaño de posición basado en el riesgo de tu cuenta
                </p>
              )}
            </div>
          </div>
          {isDesktop ? (
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
              <HelpCircle size={14} strokeWidth={2} /> Guía rápida
            </button>
          ) : (
            <button style={{ width: 32, height: 32, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, cursor: "pointer", flexShrink: 0 }}>
              <HelpCircle size={15} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Global account config */}
        <div style={{ marginBottom: 16 }}>
          <RiskCalculatorSettings
            balance={balance}
            riskPercent={riskPercent}
            riskDollar={riskDollar}
            onBalanceChange={handleBalanceChange}
            onRiskPercentChange={handleRiskPercentChange}
            onRiskDollarChange={handleRiskDollarChange}
          />
        </div>

        {/* Three independent widgets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          {widgets.map((widgetState, i) => (
            <RiskCalculatorWidget
              key={i}
              state={widgetState}
              onChange={(next) => updateWidget(i, next)}
              riskDollar={riskDollar}
            />
          ))}
        </div>

        {/* Instrument summary — read-only for now */}
        <InstrumentSettingsCard instruments={activeInstruments} />

        {isDesktop && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: font, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
              El lotaje se calcula automáticamente según el stop loss (pts) y el riesgo definido. Los cálculos son aproximados y pueden variar según el broker.
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: font, fontSize: 12, color: C.textMuted, flexShrink: 0 }}>
              Última actualización: Ahora
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
            </span>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
