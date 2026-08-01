/**
 * instrumentConfig.js
 *
 * Pure data — zero logic, zero JSX. Every instrument the Risk Calculator can
 * work with is one object in INSTRUMENTS. Adding XAUUSD/EURUSD/GBPJPY/BTCUSD
 * later means adding one more object here — nothing else in this feature
 * (the widget, the chip row, the service) needs to change.
 *
 * `pointValue` — dollars of P&L per point/pip per 1.0 lot, exactly the
 * "Valor por punto" column from the source Excel (Calculadora FX
 * $5000usd.csv). NAS100/SP500/US30 are all 1 in that sheet, which is why the
 * reference UI shows "$1.00" for all three defaults.
 *
 * `slChips` — the quick-select SL presets for that instrument. Per-
 * instrument (not shared) because a sensible NAS100 stop is a wildly
 * different number than a sensible SP500 stop. These are step 1 of the
 * "chips" feature — hand-picked defaults, easy to tune right here. Step 2
 * (chips that learn the user's most-used SL per instrument and gradually
 * replace these) is intentionally not built yet — see
 * riskCalculatorService.js's comment on where that would plug in without
 * touching this file's shape.
 */
export const INSTRUMENTS = {
  NAS100: {
    id: "NAS100",
    name: "NAS100",
    subtitle: "NASDAQ 100",
    badge: "NQ",
    color: "#4fa3ff",
    pointValue: 1,
    defaultSL: 61.24,
    slChips: [40, 50, 60, 70, 80, 100, 120],
  },
  SP500: {
    id: "SP500",
    name: "SP500",
    subtitle: "S&P 500",
    badge: "SP",
    color: "#ef4444",
    pointValue: 1,
    defaultSL: 7.61,
    slChips: [5, 7, 10, 12, 15, 20],
  },
  US30: {
    id: "US30",
    name: "US30",
    subtitle: "DOW JONES 30",
    badge: "DJ",
    color: "#8b5cf6",
    pointValue: 1,
    defaultSL: 102.35,
    slChips: [60, 80, 100, 120, 150, 180],
  },
};

// Order + which instruments populate the three default widgets. A future
// "add a 4th widget" feature just extends this list — the page component
// maps over it, it doesn't hardcode "widget 1 / widget 2 / widget 3"
// anywhere.
export const DEFAULT_WIDGET_INSTRUMENTS = ["NAS100", "SP500", "US30"];

// Every instrument id currently sold to a widget's selector — the dropdown
// shows all of INSTRUMENTS, not just the three defaults, so switching a
// widget to a different (already-configured) instrument works out of the box.
export const INSTRUMENT_LIST = Object.values(INSTRUMENTS);
