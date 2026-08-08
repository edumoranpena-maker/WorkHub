/**
 * ReadAloudButton.jsx
 *
 * "🔊 Leer descripción" — reads a content's description aloud using the
 * browser's SpeechSynthesis API (lib/textToSpeech.js). ONE shared component
 * used everywhere a description can be read: Posts, Updates, Subtemas
 * (inline, between the metadata line and the description) and the
 * fullscreen viewer (between the recorded voice note and the description).
 *
 * Independent from AudioNotePlayer/audioPlayback.js on purpose — a recorded
 * voice note and this text-to-speech reader are two separate systems that
 * never interfere with each other (different underlying engines, different
 * lifecycle rules: a voice note pauses-and-resumes across content switches,
 * this always fully stops). Visually mirrors AudioNotePlayer's compact
 * control once active, for a consistent feel — not a shared component,
 * since the interactions differ (no seek bar here; SpeechSynthesis has no
 * reliable seek target).
 *
 * Renders nothing if there's no actual text to read.
 */
import { Volume2, Pause, Play, Square } from "lucide-react";
import { useTextToSpeech, toSpeechText, SPEECH_RATES } from "../lib/textToSpeech.js";

function fmtTime(s) {
  const total = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * id: the content's own id (post/update/subtema id) — keys which content is
 *   currently being read, same convention used elsewhere in the app.
 * text: the raw description text (plain text today; URLs are stripped
 *   automatically before being spoken — see toSpeechText).
 */
export default function ReadAloudButton({ id, text, accentColor = "#22d3a0", interactive = true }) {
  const { speaking, paused, active, elapsed, total, rate, toggle, stop, setRate } = useTextToSpeech(id, text);

  if (!toSpeechText(text)) return null;

  if (!active) {
    return (
      <button onClick={interactive ? (e => { e.stopPropagation(); toggle(); }) : undefined}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none",
          padding: "4px 0", cursor: interactive ? "pointer" : "default", color: accentColor,
          fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700,
        }}>
        <Volume2 size={13} /> Leer descripción
      </button>
    );
  }

  const cycleRate = () => {
    const idx = SPEECH_RATES.indexOf(rate);
    setRate(SPEECH_RATES[(idx + 1) % SPEECH_RATES.length] ?? SPEECH_RATES[0]);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <button onClick={interactive ? (e => { e.stopPropagation(); toggle(); }) : undefined} aria-label={paused ? "Reanudar lectura" : "Pausar lectura"}
        style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: accentColor, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: interactive ? "pointer" : "default", flexShrink: 0 }}>
        {paused || !speaking ? <Play size={11} fill="#000" style={{ marginLeft: 1 }} /> : <Pause size={11} fill="#000" />}
      </button>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: accentColor }}>
        {fmtTime(elapsed)} / {fmtTime(total)}
      </span>
      <button onClick={interactive ? (e => { e.stopPropagation(); cycleRate(); }) : undefined}
        style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30`, borderRadius: 8, padding: "2px 7px", cursor: interactive ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: accentColor }}>
        {rate}×
      </button>
      <button onClick={interactive ? (e => { e.stopPropagation(); stop(); }) : undefined} aria-label="Detener lectura"
        style={{ background: "none", border: "none", padding: 2, cursor: interactive ? "pointer" : "default", color: `${accentColor}99`, display: "flex" }}>
        <Square size={11} />
      </button>
    </div>
  );
}
