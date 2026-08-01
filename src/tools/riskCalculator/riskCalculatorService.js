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
 * (risk recomputed after that rounding) columns are deliberately NOT ported
 * — explicitly out of scope per the brief ("omite detalles innecesarios
 * como redondeo"). Every risk figure shown anywhere in this UI is the same
 * theoretical riskDollar value, never a post-rounding recalculation.
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
