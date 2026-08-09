/**
 * ProgressDots.jsx
 *
 * The dot-and-line progress indicator for a checklist in progress —
 * deliberately NOT a percentage bar. One dot per step; the connecting
 * segments between two completed dots fill in as steps get checked, so the
 * line visibly "grows" left to right instead of a single blob of fill.
 *
 * Pure/presentational — takes `total` and `completed` (count of steps
 * checked, in order — this tool doesn't support checking step 3 before step
 * 1, so "completed" as a simple count is enough to know which dots/segments
 * are filled) and renders. No state of its own.
 */
const font = "'DM Sans', sans-serif";

export default function ProgressDots({ total, completed, accent = "#d4a843", trackColor = "#1c1c2e" }) {
  if (total <= 0) return null;
  const dots = Array.from({ length: total }, (_, i) => i < completed);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        {dots.map((filled, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < total - 1 ? 1 : "0 0 auto" }}>
            <div style={{
              width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
              background: filled ? accent : "transparent",
              border: `2px solid ${filled ? accent : trackColor}`,
              boxShadow: filled ? `0 0 8px ${accent}80` : "none",
              transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
            }} />
            {i < total - 1 && (
              <div style={{
                flex: 1, height: 2, marginInline: 2, borderRadius: 1,
                // A segment is "filled" only once BOTH the dot before and
                // after it are checked — this is what makes the line read as
                // growing step by step rather than jumping ahead of the
                // actual checked dots.
                background: (i + 1 < completed) ? accent : trackColor,
                transition: "background 0.25s ease",
              }} />
            )}
          </div>
        ))}
      </div>
      <span style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: accent, letterSpacing: "0.02em" }}>
        {completed} / {total}
      </span>
    </div>
  );
}
