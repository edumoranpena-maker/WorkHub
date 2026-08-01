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
 *      keeps stepping, easing from precise (1x) to fast (up to 20x) the
 *      longer it's held, so both a one-cent nudge and a long traversal are
 *      one gesture. A touch that drifts past a small slop threshold is
 *      reclassified as a scroll mid-gesture — the repeat stops immediately
 *      and the touch is released back to the browser's native scrolling,
 *      so a finger passing over a button while scrolling never gets stuck
 *      incrementing.
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
const HOLD_PRECISION_WINDOW = 550; // ms of repeating at 1x before acceleration begins at all
const HOLD_ACCEL_RAMP = 2200;    // ms it takes to smoothly ramp from 1x up to max once accelerating
const HOLD_ACCEL_MAX = 20;       // cap so it never becomes an uncontrollable jump
const TOUCH_MOVE_SLOP = 10;      // px of finger movement that reclassifies a touch as a scroll, not a press
const GHOST_CLICK_GUARD = 500;   // ms after a touch event to ignore a synthetic mousedown on the same button

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
  // Acceleration is time-based and continuous, not a stepwise multiplier
  // bump — it stays at 1x for HOLD_PRECISION_WINDOW ms once repeating
  // starts (a deliberate "slow moment" for fine adjustments), then eases
  // up smoothly (quadratic, not linear) toward HOLD_ACCEL_MAX over
  // HOLD_ACCEL_RAMP ms, so long holds still cover distance fast without a
  // jarring jump past the target.
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const repeatStartRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const doStep = useCallback((direction) => {
    const factor = 10 ** decimals;
    const next = (Number(valueRef.current) || 0) + direction * step;
    // Round to the field's own decimal precision so repeated 0.01 steps
    // never drift into floating-point noise (0.1 + 0.2 territory).
    const rounded = Math.round(next * factor) / factor;
    onChange(Math.max(0, rounded));
  }, [onChange, step, decimals]);

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current) { clearTimeout(holdTimeoutRef.current); holdTimeoutRef.current = null; }
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
  }, []);

  const startHold = useCallback((direction) => {
    doStep(direction); // immediate single step on press — taps stay instant
    stopHold();
    // Wait HOLD_INITIAL_DELAY before repeating, so a quick tap never
    // double-steps. Once repeating begins, the clock for acceleration
    // starts fresh from here (not from the original press).
    holdTimeoutRef.current = setTimeout(() => {
      repeatStartRef.current = Date.now();
      holdIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - repeatStartRef.current;
        let multiplier = 1;
        if (elapsed > HOLD_PRECISION_WINDOW) {
          const t = Math.min(1, (elapsed - HOLD_PRECISION_WINDOW) / HOLD_ACCEL_RAMP);
          multiplier = 1 + (HOLD_ACCEL_MAX - 1) * t * t; // ease-in, not a jump
        }
        doStep(direction * multiplier);
      }, HOLD_TICK);
    }, HOLD_INITIAL_DELAY);
  }, [doStep, stopHold]);

  useEffect(() => stopHold, [stopHold]); // clear any pending timer on unmount

  // Distinguishing an intentional hold from a scroll gesture that happens
  // to start on the button: track the touch's start position, and the
  // moment it drifts past TOUCH_MOVE_SLOP, treat it as a scroll — stop any
  // repeat in progress and let the browser's native scroll take over
  // uninterrupted (touchstart is deliberately NOT preventDefault'd, so
  // scrolling that begins on this button is never blocked).
  const touchStartPosRef = useRef(null);
  const lastTouchTimeRef = useRef(0);

  const handleTouchStart = useCallback((direction) => (e) => {
    const t = e.touches[0];
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    lastTouchTimeRef.current = Date.now();
    startHold(direction);
  }, [startHold]);

  const handleTouchMove = useCallback((e) => {
    const start = touchStartPosRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - start.x);
    const dy = Math.abs(t.clientY - start.y);
    if (dx > TOUCH_MOVE_SLOP || dy > TOUCH_MOVE_SLOP) {
      stopHold();
      touchStartPosRef.current = null; // this touch is a scroll now, ignore its rest
    }
  }, [stopHold]);

  const handleTouchEnd = useCallback(() => {
    touchStartPosRef.current = null;
    stopHold();
  }, [stopHold]);

  const handleMouseDown = useCallback((direction) => () => {
    // A touch that ends near a mouse-compat "ghost click" would otherwise
    // double-step this same press on some browsers/webviews.
    if (Date.now() - lastTouchTimeRef.current < GHOST_CLICK_GUARD) return;
    startHold(direction);
  }, [startHold]);

  const StepButton = ({ direction, Icon }) => (
    <button
      onMouseDown={handleMouseDown(direction)}
      onMouseUp={stopHold}
      onMouseLeave={stopHold}
      onTouchStart={handleTouchStart(direction)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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
