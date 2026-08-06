/**
 * AudioNotePlayer.jsx
 *
 * The ONE voice-note player component for the whole app — Posts, Updates,
 * Subtemas, Thread (all via VoiceAndMedia in Post.jsx) and the fullscreen
 * image viewer (GlobalImageViewer.jsx) all render this exact component.
 * Actual playback state lives outside React entirely, in the shared
 * singleton in lib/audioPlayback.js, so the same voice note keeps playing
 * uninterrupted whether it's shown in the feed or in fullscreen, and
 * switching to a different piece of content pauses (never restarts) it.
 *
 * Deliberately minimal, per product spec: play/pause, progress bar,
 * current/duration time, speed selector. No waveform, no card chrome — this
 * is meant to sit compactly above a description or inline in a bubble.
 */
import { useRef, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { useAudioPlayback } from "../lib/audioPlayback.js";

const SPEEDS = [0.5, 1, 1.5, 2];

function fmtTime(s) {
  const total = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * audio: { url, duration } — duration is the real captured seconds from
 *   audioRecorder.js, used to seed the display before playback starts.
 * accentColor: optional CSS color, defaults to the app teal.
 */
export default function AudioNotePlayer({ audio, accentColor = "#22d3a0" }) {
  const { currentTime, duration, playing, speed, toggle, seek, setSpeed } =
    useAudioPlayback(audio?.url, { knownDuration: audio?.duration || 0 });

  const barRef = useRef(null);

  const effectiveDuration = duration || audio?.duration || 0;
  const progress = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  const seekFromClientX = useCallback((clientX) => {
    const el = barRef.current;
    if (!el || effectiveDuration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seek(ratio * effectiveDuration);
  }, [effectiveDuration, seek]);

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length] ?? SPEEDS[0]);
  };

  if (!audio?.url) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px" }}>
      <button onClick={e => { e.stopPropagation(); toggle(); }} aria-label={playing ? "Pausar" : "Reproducir"}
        style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: accentColor, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        {playing ? <Pause size={12} fill="#000" /> : <Play size={12} fill="#000" style={{ marginLeft: 1 }} />}
      </button>

      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: accentColor, flexShrink: 0, minWidth: currentTime > 0 ? 62 : 28, textAlign: "left" }}>
        {currentTime > 0 ? `${fmtTime(currentTime)} / ${fmtTime(effectiveDuration)}` : fmtTime(effectiveDuration)}
      </span>

      <div
        ref={barRef}
        onClick={e => { e.stopPropagation(); seekFromClientX(e.clientX); }}
        onPointerDown={e => { e.stopPropagation(); }}
        style={{ flex: 1, height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}
      >
        <div style={{ position: "relative", width: "100%", height: 3, borderRadius: 2, background: `${accentColor}30` }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, borderRadius: 2, background: accentColor }} />
          <div style={{ position: "absolute", top: "50%", left: `${progress * 100}%`, width: 9, height: 9, borderRadius: "50%", background: accentColor, transform: "translate(-50%, -50%)", boxShadow: `0 0 6px ${accentColor}80` }} />
        </div>
      </div>

      <button onClick={e => { e.stopPropagation(); cycleSpeed(); }}
        style={{ flexShrink: 0, background: `${accentColor}18`, border: `1px solid ${accentColor}30`, borderRadius: 8, padding: "3px 7px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 700, color: accentColor }}>
        x{speed}
      </button>
    </div>
  );
}
