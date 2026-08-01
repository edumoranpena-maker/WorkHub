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
 *   2. Single-tap +/- buttons, no hold-to-repeat — each tap fires exactly
 *      once, no acceleration, no auto-repeat while held. What a tap does
 *      is the caller's choice: pass `onStep(direction)` for custom jump
 *      logic (e.g. the SL field's lot-state navigation), or fall back to a
 *      fixed `step` added/subtracted from `value`. Either way, the step is
 *      only committed on release (touchend/click) and only if the touch
 *      never drifted past a small slop threshold — a vertical drag that
 *      starts on the button is a scroll, not a tap, and is let through to
 *      the browser untouched (no preventDefault on touchstart/touchmove).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Minus, Plus } from "lucide-react";

const font = "'DM Sans', sans-serif";
const C = {
  card: "#121212", cardHover: "#1a1a1a", border: "#1c1c2e",
  text: "#fafafa", textMuted: "#8e8e8e",
};

const TOUCH_MOVE_SLOP = 10; // px of finger movement that reclassifies a touch as a scroll, not a tap

export default function RiskCalculatorInput({ value, onChange, onStep, step = 1, decimals = 2, prefix, accentColor, showSteps = true }) {
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

  // ── Single-tap step, scroll-safe ────────────────────────────────────────
  const valueRef = useRef(value);
  valueRef.current = value;

  const fireStep = useCallback((direction) => {
    if (onStep) { onStep(direction); return; }
    const factor = 10 ** decimals;
    const next = (Number(valueRef.current) || 0) + direction * step;
    // Round to the field's own decimal precision so repeated steps never
    // drift into floating-point noise (0.1 + 0.2 territory).
    const rounded = Math.round(next * factor) / factor;
    onChange(Math.max(0, rounded));
  }, [onChange, onStep, step, decimals]);

  // Touch: commit only on release, and only if the finger never moved past
  // the slop threshold — that's what makes a vertical scroll starting on
  // the button do nothing here instead of firing a step.
  const touchStartPosRef = useRef(null);
  const touchScrollingRef = useRef(false);
  const lastTouchTimeRef = useRef(0);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    touchScrollingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e) => {
    const start = touchStartPosRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - start.x);
    const dy = Math.abs(t.clientY - start.y);
    if (dx > TOUCH_MOVE_SLOP || dy > TOUCH_MOVE_SLOP) touchScrollingRef.current = true;
  }, []);

  const handleTouchEnd = useCallback((direction) => (e) => {
    lastTouchTimeRef.current = Date.now();
    const wasTap = touchStartPosRef.current && !touchScrollingRef.current;
    touchStartPosRef.current = null;
    if (wasTap) {
      // Stop the browser's synthetic click that would otherwise follow this
      // touch — without it, a tap here would fire the step twice (once from
      // this handler, once from the onClick below).
      e.preventDefault();
      fireStep(direction);
    }
  }, [fireStep]);

  const handleTouchCancel = useCallback(() => {
    touchStartPosRef.current = null;
    touchScrollingRef.current = false;
  }, []);

  const handleClick = useCallback((direction) => () => {
    // Only reachable from a real mouse/trackpad click — touch taps are
    // already handled (and preventDefault'd) in handleTouchEnd above, so
    // this never double-fires on touch devices.
    if (Date.now() - lastTouchTimeRef.current < 500) return;
    fireStep(direction);
  }, [fireStep]);

  const StepButton = ({ direction, Icon }) => (
    <button
      onClick={handleClick(direction)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd(direction)}
      onTouchCancel={handleTouchCancel}
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
