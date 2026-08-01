/**
 * RiskCalculatorWidget.jsx
 *
 * One independent calculator card. Owns nothing about global config (that's
 * passed in as `riskDollar`) and nothing about persistence — it's a
 * controlled component: `state` ({ instrumentId, sl }) comes from
 * RiskCalculatorPage, `onChange(nextState)` reports edits back up. That's
 * what makes "three widgets, fully independent, but a future persistence
 * layer can serialize all three from one place" work without this file
 * needing to know persistence exists.
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { INSTRUMENTS, INSTRUMENT_LIST } from "./instrumentConfig.js";
import { calculateLot, getSlChips } from "./riskCalculatorService.js";
import RiskCalculatorInput from "./RiskCalculatorInput.jsx";
import RiskCalculatorChipRow from "./RiskCalculatorChipRow.jsx";
import RiskCalculatorResult from "./RiskCalculatorResult.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
};

function InstrumentBadge({ instrument, size = 34 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 9, flexShrink: 0, background: `${instrument.color}22`, border: `1px solid ${instrument.color}45`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: font, fontSize: size * 0.32, fontWeight: 800, color: instrument.color }}>{instrument.badge}</span>
    </div>
  );
}

export default function RiskCalculatorWidget({ state, onChange, riskDollar }) {
  const instrument = INSTRUMENTS[state.instrumentId];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const lot = calculateLot(riskDollar, state.sl, instrument.pointValue);
  const chips = getSlChips(instrument);

  const selectInstrument = (id) => {
    const next = INSTRUMENTS[id];
    // Switching instrument resets SL to that instrument's own sensible
    // default rather than keeping a stale number from a totally different
    // market — a NAS100 stop of 61 means nothing on SP500.
    onChange({ instrumentId: id, sl: next.defaultSL });
    setMenuOpen(false);
  };

  return (
    <div style={{ position: "relative", background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${instrument.color}`, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header — badge + name/subtitle + selector chevron */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen(v => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <InstrumentBadge instrument={instrument} />
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <p style={{ margin: 0, fontFamily: font, fontSize: 15, fontWeight: 800, color: C.text }}>{instrument.name}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 11, color: C.textMuted }}>
              {instrument.subtitle} <span style={{ opacity: 0.7 }}>· ${instrument.pointValue.toFixed(2)}/pt</span>
            </p>
          </div>
          <ChevronDown size={16} color={C.textMuted} strokeWidth={2.2} style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
        </button>

        {menuOpen && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 10, background: C.cardHover, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            {INSTRUMENT_LIST.map(opt => (
              <button key={opt.id} onClick={() => selectInstrument(opt.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: opt.id === instrument.id ? `${opt.color}14` : "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <InstrumentBadge instrument={opt} size={26} />
                <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.text }}>{opt.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SL (pts) */}
      <div>
        <p style={{ margin: "0 0 6px", fontFamily: font, fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>SL (pts)</p>
        <RiskCalculatorInput
          value={state.sl}
          onChange={(sl) => onChange({ ...state, sl })}
          step={0.01}
          decimals={2}
        />
      </div>

      <RiskCalculatorChipRow
        values={chips}
        activeValue={state.sl}
        accentColor={instrument.color}
        onSelect={(sl) => onChange({ ...state, sl })}
      />

      <RiskCalculatorResult lot={lot} riskDollar={riskDollar} accentColor={instrument.color} />
    </div>
  );
}
