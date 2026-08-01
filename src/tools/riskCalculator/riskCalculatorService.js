/**
 * riskCalculatorService.js
 *
 * Every formula the Risk Calculator uses, extracted from
 * "Lotaje_por_SL_5000usd.xlsx" (sheet "Calculadora FX $5000.csv") and kept
 * completely separate from any component — no JSX, no React state, no DOM.
 * This is the "RiskCalculatorService" called for in the architecture: pure
 * functions in, values out, so the math can be verified independently of
 * how it's displayed and reused by any future widget or tool.
 *
 * ── Source formulas (Excel cell references, $5000 sheet) ──────────────────
 *   D2  Riesgo teórico  = $C$11 * $C$12              (Balance * Risk%)
 *   E2  Valor pip       = VLOOKUP(instrument, ...)   (→ instrumentConfig.js's pointValue)
 *   C2  Lotaje estimado = D2 / (B2 * E2)              (RiesgoUSD / (SL * pointValue))
 *
 * Verified against the reference screenshot (Balance $5,000, Risk 0.70% →
 * Risk $35.00): NAS100 35/61.24=0.5715→0.57 ✓, SP500 35/7.61=4.5992→4.60 ✓,
 * US30 35/102.35=0.3420→0.34 ✓ — all three match exactly.
 *
 * The Excel's "Redondeo" (broker lot-step rounding) and "Riesgo exacto"
 * (risk recomputed after that rounding) columns were initially left out of
 * this port. They're back, but scoped: riskDollarFromPercent() is still the
 * flat theoretical target used for entry/typed SL and the Settings screen.
 * realRiskFromLot() (below) is the post-rounding figure, used only while
 * navigating between lot states with the SL +/- buttons — there, the whole
 * point is comparing what each rounded-lot state actually risks.
 */

/** Balance * Risk% → dollars at risk. Risk% is a plain number (0.7 = 0.7%,
 *  NOT a 0-1 fraction) matching how it's entered/displayed in the UI. */
export function riskDollarFromPercent(balance, riskPercent) {
  const b = Number(balance) || 0;
  const p = Number(riskPercent) || 0;
  return b * (p / 100);
}

/** Inverse of the above — used when the user edits Riesgo($) directly, so
 *  Riesgo(%) can be kept in sync against the same Balance. */
export function riskPercentFromDollar(balance, riskDollar) {
  const b = Number(balance) || 0;
  if (b <= 0) return 0;
  const d = Number(riskDollar) || 0;
  return (d / b) * 100;
}

/** RiesgoUSD / (SL * pointValue) — the core formula, Excel cell C2. Returns
 *  0 (not NaN/Infinity) for any invalid input so the UI never has to guard
 *  against displaying garbage while a field is mid-edit or empty. */
export function calculateLot(riskDollar, slPoints, pointValue) {
  const r = Number(riskDollar) || 0;
  const sl = Number(slPoints) || 0;
  const pv = Number(pointValue) || 0;
  if (sl <= 0 || pv <= 0) return 0;
  return r / (sl * pv);
}

// ─── Display formatting ──────────────────────────────────────────────────
// Kept here (not scattered across components) so every widget/card formats
// the same kind of number identically, and so it's one place to adjust if
// the precision requirements ever change.
export const fmtMoney = v => `$${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPercent = v => `${(Number(v) || 0).toFixed(2)}%`;
export const fmtLot = v => (Number(v) || 0).toFixed(2);
export const fmtPoints = v => (Number(v) || 0).toFixed(2);

// ─── Lot-state navigation (for the SL +/- buttons) ─────────────────────────
// The +/- buttons no longer walk the SL cent by cent — they jump straight
// to the next SL value where the *displayed* lot (rounded to 2 decimals,
// same rounding as fmtLot) actually changes. Everything between two such
// points rounds to the same lot, so it's not a distinct execution state —
// only the boundary is. Uses calculateLot() itself, so it can never drift
// from the one formula the rest of the calculator uses.
const SL_STEP = 0.01;          // matches the SL field's own decimal resolution
const SL_SEARCH_LIMIT = 10000; // hard cap (±100 pts) so a flat/edge-case
                                // instrument can never hang the UI searching
                                // for a lot change that isn't there

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** The lot value as it's actually shown to the user — this, not the raw
 *  continuous division result, is what defines a "state" for navigation
 *  purposes (two SL values that round to the same lot are the same state). */
export function roundedLot(riskDollar, slPoints, pointValue) {
  return round2(calculateLot(riskDollar, slPoints, pointValue));
}

/** Search outward from currentSl in the given direction (+1 or -1) for the
 *  next SL value whose rounded lot differs from the current one, and
 *  return that SL. Every value strictly between currentSl and the result
 *  rounds to the same lot as currentSl, so skipping straight there loses
 *  no real information — it's the same jump the user would end up at by
 *  walking every cent by hand. */
export function findNextLotState(currentSl, direction, riskDollar, pointValue) {
  const startSl = Number(currentSl) || 0;
  const baseLot = roundedLot(riskDollar, startSl, pointValue);
  let cursor = startSl;
  for (let i = 0; i < SL_SEARCH_LIMIT; i++) {
    cursor = round2(cursor + direction * SL_STEP);
    if (cursor <= 0) return SL_STEP; // never navigate to/past a zero or negative SL
    if (roundedLot(riskDollar, cursor, pointValue) !== baseLot) return cursor;
  }
  return cursor; // no lot change found in range — land wherever the search stopped
}

/** The real dollar risk of the *current, rounded* lot — not the flat
 *  theoretical target. Two different SL states legitimately carry two
 *  different real risk figures (a smaller rounded lot slightly under-risks,
 *  a larger one slightly over-risks); this is what the user compares when
 *  browsing states with the +/- buttons. */
export function realRiskFromLot(lot, slPoints, pointValue) {
  return (Number(lot) || 0) * (Number(slPoints) || 0) * (Number(pointValue) || 0);
}

// ─── Chips — stage 1 (static) ──────────────────────────────────────────────
// Returns the configured presets for an instrument as-is. This is the ONE
// function a widget calls to get its chip list — stage 2 (learned chips)
// becomes a drop-in replacement for this function's body only: swap the
// static `instrument.slChips` read below for a query against the user's
// historical SL values per instrument (once that history is persisted —
// see the persistence note in RiskCalculatorPage.jsx). No caller of
// getSlChips() would need to change when that happens.
export function getSlChips(instrument) {
  return instrument?.slChips ?? [];
}
