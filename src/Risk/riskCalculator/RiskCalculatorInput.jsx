/**
 * RiskCalculatorInput.jsx
 *
 * A numeric field with +/- step buttons, used for both the SL (pts) field
 * inside each widget and the Balance/Risk% fields in Settings — anywhere
 * this calculator needs "type a number, or nudge it with buttons, instant
 * feedback either way".
 *
 * Two interaction details this file exists specifically to get right:
 *
 *   1. Tap-to-select-all — tapping the number selects its entire contents
 *      immediately, so typing a new value never requires deleting the old
 *      one first. `select()` on focus alone isn't reliable across browsers
 *      because the same tap's mouseup/touchend re-collapses the selection
 *      by placing the cursor where the tap landed; `justFocusedRef` blocks
 *      that one follow-up event, then gets out of the way.
 *
 *   2. Hold-to-repeat +/- buttons — a single press steps once; holding
 *      keeps stepping, accelerating the longer it's held, so covering a
 *      large distance never means mashing the button. Implemented as one
 *      interval ticking at a constant short rate, multiplying the step size
 *      by a factor that grows with elapsed hold time — simpler and just as
 *      smooth as re-scheduling the interval itself at a shrinking delay.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Minus, Plus } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
};

const HOLD_INITIAL_DELAY = 400;  // ms before repeat kicks in after the first step
const HOLD_TICK = 50;            // ms between repeated steps once held
const HOLD_ACCEL_EVERY = 700;    // ms of holding before the step multiplier grows again
const HOLD_ACCEL_MAX = 20;       // cap so it never becomes an uncontrollable jump

export default function RiskCalculatorInput({ value, onChange, step = 1, decimals = 2, prefix, accentColor, showSteps = true }) {
  const [text, setText] = useState(() => Number(value ?? 0).toFixed(decimals));
  const focusedRef = useRef(false);
  const justFocusedRef = useRef(false);
  const inputRef = useRef(null);

  // External changes (chip tap, +/- buttons, another widget resetting this
  // one) update the displayed text — but only while the user isn't actively
  // typing in it, otherwise a re-render mid-keystroke would clobber
  // whatever partial value they're entering (e.g. "61." while typing "61.5").
  useEffect(() => {
    if (!focusedRef.current) setText(Number(value ?? 0).toFixed(decimals));
  }, [value, decimals]);

  const commit = useCallback((raw) => {
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) onChange(parsed);
  }, [onChange]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    // Real-time: push every valid intermediate value straight through, no
    // "Calcular" button, no waiting for blur.
    if (raw !== "" && raw !== "-" && !raw.endsWith(".")) commit(raw);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const parsed = parseFloat(text);
    const finalValue = Number.isNaN(parsed) ? Number(value ?? 0) : parsed;
    setText(finalValue.toFixed(decimals));
    onChange(finalValue);
  };

  const handleFocus = (e) => {
    focusedRef.current = true;
    justFocusedRef.current = true;
    e.target.select();
  };

  const handleMouseUp = (e) => {
    if (justFocusedRef.current) {
      e.preventDefault();
      justFocusedRef.current = false;
    }
  };

  // ── Hold-to-repeat ────────────────────────────────────────────────────────
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const holdStartRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const doStep = useCallback((direction) => {
    const next = (Number(valueRef.current) || 0) + direction * step;
    onChange(Math.max(0, next));
  }, [onChange, step]);

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current) { clearTimeout(holdTimeoutRef.current); holdTimeoutRef.current = null; }
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
  }, []);

  const startHold = useCallback((direction) => {
    doStep(direction); // immediate single step on press
    holdStartRef.current = Date.now();
    stopHold();
    // Wait HOLD_INITIAL_DELAY before repeating, so a quick tap never
    // double-steps — then repeat at a constant tick, scaling the step size
    // up the longer the button stays held.
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - holdStartRef.current;
        const accel = Math.min(HOLD_ACCEL_MAX, 1 + Math.floor(elapsed / HOLD_ACCEL_EVERY));
        doStep(direction * accel);
      }, HOLD_TICK);
    }, HOLD_INITIAL_DELAY);
  }, [doStep, stopHold]);

  useEffect(() => stopHold, [stopHold]); // clear any pending timer on unmount

  const StepButton = ({ direction, Icon }) => (
    <button
      onMouseDown={() => startHold(direction)}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={(e) => { e.preventDefault(); startHold(direction); }}
      onTouchEnd={stopHold}
      style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: 12,
        background: C.cardHover, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: C.text, WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}>
      <Icon size={16} strokeWidth={2.4} />
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {showSteps && <StepButton direction={-1} Icon={Minus} />}
      <div style={{ flex: 1, position: "relative", height: 44, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "0 12px" }}>
        {prefix && <span style={{ fontFamily: font, fontSize: 14, color: C.textMuted, marginRight: 4 }}>{prefix}</span>}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseUp={handleMouseUp}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontFamily: font, fontSize: 17, fontWeight: 700,
            color: accentColor ?? C.text, textAlign: prefix ? "right" : "center",
            width: "100%",
          }}
        />
      </div>
      {showSteps && <StepButton direction={1} Icon={Plus} />}
    </div>
  );
}
