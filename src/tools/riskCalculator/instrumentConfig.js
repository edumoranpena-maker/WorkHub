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
 * `lotStep` / `minLot` — the broker's real lot granularity for this
 * instrument. This is what turns the continuous "ideal" lot from the risk
 * formula into an actually tradeable lot size, and is the foundation the
 * whole group-navigation system in riskCalculatorService.js is built on.
 * Confirmed 0.01/0.01 for all three current instruments — kept per-
 * instrument (not a shared constant) because a future instrument may well
 * use a coarser broker step.
 *
 * `slChips` was removed — chips are no longer static presets. They're
 * generated dynamically from real lot-groups around `defaultSL` (see
 * riskCalculatorService.js's generateGroupChips), so they always reflect
 * the current balance/risk/instrument instead of going stale when those
 * change.
 */
export const INSTRUMENTS = {
  NAS100: {
    id: "NAS100",
    name: "NAS100",
    subtitle: "NASDAQ 100",
    badge: "NQ",
    color: "#4fa3ff",
    pointValue: 1,
    lotStep: 0.01,
    minLot: 0.01,
    defaultSL: 61.24,
  },
  SP500: {
    id: "SP500",
    name: "SP500",
    subtitle: "S&P 500",
    badge: "SP",
    color: "#ef4444",
    pointValue: 1,
    lotStep: 0.01,
    minLot: 0.01,
    defaultSL: 7.61,
  },
  US30: {
    id: "US30",
    name: "US30",
    subtitle: "DOW JONES 30",
    badge: "DJ",
    color: "#8b5cf6",
    pointValue: 1,
    lotStep: 0.01,
    minLot: 0.01,
    defaultSL: 102.35,
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
