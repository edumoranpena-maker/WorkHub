/**
 * audioRecorder.js
 *
 * The voice-note pipeline is conceptually independent from the media
 * (image/video/file) attachment system — see attachments.js's own header
 * comment, which explicitly does not handle audio. This module is the voice
 * note's equivalent home: the one shared place for actually operating the
 * microphone (start/stop/cancel a MediaRecorder), tracking how long the
 * recording ran, and producing a waveform to render later.
 *
 * Deliberately does NOT talk to Supabase Storage or upload anything — same
 * separation of concerns as attachments.js's mapFilesToMedia. What happens
 * to the resulting { blob, duration, waveform, url } is entirely up to the
 * caller:
 *   - PostComposer.jsx (Posts/Updates/Subtemas) keeps it as local component
 *     state and only uploads the blob when the user hits Publish — same
 *     "nothing touches Supabase until submit" contract every other
 *     attachment in the composer already follows.
 *   - useAudioUpload.js wraps this hook and additionally uploads to Storage
 *     the moment recording stops, for any context that explicitly wants
 *     that instead (nothing does today, but it stays available without
 *     duplicating the MediaRecorder mechanics here).
 */
import { useRef, useState, useCallback, useEffect } from "react";

const WAVEFORM_BARS = 20;

// A lightweight waveform for the recording just made. Real amplitude
// analysis (Web Audio API AnalyserNode) is future work — this already
// replaces the previous behavior of no waveform being generated at all,
// and both call sites already treated `waveform` as illustrative bars
// rather than a precise amplitude graph.
export function generateWaveform() {
  return Array.from({ length: WAVEFORM_BARS }, () => Math.random() * 0.7 + 0.2);
}

/**
 * useAudioRecorder({ onDone, onCancel })
 *
 * onDone({ blob, duration, waveform, url }) — called once recording stops
 *   normally. `url` is a local blob: URL for immediate preview/playback;
 *   callers that upload are responsible for revoking it once they have a
 *   persistent URL.
 * onCancel() — called when cancel() is used instead of stop() (discards the
 *   recording, no onDone call).
 *
 * Does NOT auto-start on mount — start() is explicit, matching the existing
 * mic-button toggle UX (tap to start, tap again to stop) already used in
 * every composer.
 */
export function useAudioRecorder({ onDone, onCancel } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);
  const secondsRef  = useRef(0);

  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => () => { clearInterval(timerRef.current); stopStream(); }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  const start = useCallback(() => {
    setError(null);
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const mr = new MediaRecorder(stream);
        mediaRecRef.current = mr;
        chunksRef.current = [];
        setSeconds(0);
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const duration = secondsRef.current;
          const waveform = generateWaveform();
          const url = URL.createObjectURL(blob);
          onDone?.({ blob, duration, waveform, url });
        };
        mr.start();
        setIsRecording(true);
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      })
      .catch(() => setError("Microphone access denied"));
  }, [onDone]);

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    const mr = mediaRecRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    stopStream();
    setIsRecording(false);
  }, []);

  const cancel = useCallback(() => {
    clearInterval(timerRef.current);
    const mr = mediaRecRef.current;
    if (mr) {
      mr.ondataavailable = null;
      mr.onstop = null;
      try { if (mr.state !== "inactive") mr.stop(); } catch {}
    }
    stopStream();
    setIsRecording(false);
    setSeconds(0);
    onCancel?.();
  }, [onCancel]);

  return { start, stop, cancel, isRecording, seconds, error };
}
