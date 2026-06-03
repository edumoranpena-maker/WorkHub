/**
 * AIPromptPanel.jsx
 *
 * UI for the hybrid personalization engine.
 * Shows engine indicator: "Local" (instant, zero cost) or "AI" (Claude API).
 * The user never chooses — the system classifies automatically.
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  applyPersonalizationPrompt,
  applyPreset,
  PRESET_CONFIGS,
} from "../engine/aiPersonalization.js";

const font = "'DM Sans', sans-serif";

const QUICK_PRESETS = [
  { id: "minimal", emoji: "◻", label: "Minimal" },
  { id: "premium", emoji: "✦", label: "Premium" },
  { id: "trader",  emoji: "📈", label: "Trader"  },
  { id: "social",  emoji: "🌐", label: "Social"  },
  { id: "default", emoji: "↺", label: "Reset"   },
];

function diffSummary(diff) {
  if (!diff) return [];
  const lines = [];
  if (diff.theme?.paletteId)        lines.push(`Theme → ${diff.theme.paletteId}`);
  if (diff.theme?.borderRadius)     lines.push(`Borders → ${diff.theme.borderRadius}`);
  if (diff.theme?.density)          lines.push(`Density → ${diff.theme.density}`);
  if (diff.theme?.glowEffects != null) lines.push(`Glow → ${diff.theme.glowEffects ? "on" : "off"}`);
  if (diff.theme?.animationSpeed)   lines.push(`Animations → ${diff.theme.animationSpeed}`);
  if (diff.theme?.fontScale)        lines.push(`Font scale → ${diff.theme.fontScale}`);
  if (diff.layout?.profileTemplate) lines.push(`Layout → ${diff.layout.profileTemplate}`);
  if (diff.sections) {
    const hidden  = diff.sections.filter(s => s.visible === false).map(s => s.id);
    const shown   = diff.sections.filter(s => s.visible === true).map(s => s.id);
    const ordered = diff.sections.filter(s => "order" in s && s.visible == null);
    if (hidden.length)  lines.push(`Hidden: ${hidden.join(", ")}`);
    if (shown.length)   lines.push(`Shown: ${shown.join(", ")}`);
    if (ordered.length) lines.push(`Reordered ${ordered.length} section(s)`);
  }
  if (diff.feedWidgets) {
    const hidden  = diff.feedWidgets.filter(w => w.visible === false).map(w => w.id);
    const shown   = diff.feedWidgets.filter(w => w.visible === true).map(w => w.id);
    const ordered = diff.feedWidgets.filter(w => "order" in w && w.visible == null);
    if (hidden.length)  lines.push(`Hidden widgets: ${hidden.join(", ")}`);
    if (shown.length)   lines.push(`Shown widgets: ${shown.join(", ")}`);
    if (ordered.length) lines.push(`Reordered ${ordered.length} widget(s)`);
  }
  return lines;
}

export function AIPromptPanel({ currentConfig, onApply, onClose }) {
  const [prompt,    setPrompt]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [showDiff,  setShowDiff]  = useState(false);
  const textRef = useRef(null);

  const handlePrompt = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResult(null);
    const { newConfig, diff, applied, engine, label, error } =
      await applyPersonalizationPrompt(prompt, currentConfig);
    setLoading(false);
    setResult({ applied, error, diff, engine, label });
    if (applied) { onApply(newConfig); setPrompt(""); }
  };

  const handlePreset = (presetId) => {
    const { newConfig, applied } = applyPreset(presetId, currentConfig);
    if (applied) {
      onApply(newConfig);
      setResult({ applied: true, error: null, diff: PRESET_CONFIGS[presetId], engine: "local", label: `Preset: ${presetId}` });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: "min(540px, calc(100vw - 28px))",
        background: "rgba(13,13,25,0.97)",
        border: "1px solid rgba(124,77,255,0.35)",
        borderRadius: 20, padding: "18px 18px 14px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,77,255,0.12)",
        backdropFilter: "blur(24px)", zIndex: 9999, fontFamily: font,
      }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(124,77,255,0.2)", border: "1px solid rgba(124,77,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={14} color="#9d71ff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#eaeaf5", letterSpacing: "-0.01em" }}>AI Profile Studio</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#9d71ff", background: "rgba(124,77,255,0.15)", border: "1px solid rgba(124,77,255,0.3)", borderRadius: 99, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Hybrid</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6a6a82", padding: 4 }}>
          <X size={16} />
        </button>
      </div>



      {/* Quick presets */}
      <div style={{ display: "flex", gap: 5, marginBottom: 11, flexWrap: "wrap" }}>
        {QUICK_PRESETS.map(p => (
          <motion.button key={p.id} whileTap={{ scale: 0.9 }} onClick={() => handlePreset(p.id)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#8a8aaa", fontFamily: font }}>
            <span style={{ fontSize: 12 }}>{p.emoji}</span>{p.label}
          </motion.button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1, background: "rgba(8,8,14,0.8)", border: `1.5px solid ${prompt.trim() ? "rgba(124,77,255,0.5)" : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: "10px 14px 8px", transition: "border-color 0.2s" }}>
          <textarea
            ref={textRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePrompt(); } }}
            placeholder='e.g. "hide badges", "trader dark theme", "make it feel like a cyberpunk dashboard"…'
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", background: "none", border: "none", outline: "none", resize: "none", color: "#eaeaf5", fontFamily: font, fontSize: 13, lineHeight: 1.55, caretColor: "#9d71ff" }}
          />

        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={handlePrompt}
          disabled={!prompt.trim() || loading}
          style={{ width: 44, height: 44, borderRadius: 12, border: "none", flexShrink: 0, cursor: prompt.trim() && !loading ? "pointer" : "default", background: prompt.trim() && !loading ? "linear-gradient(135deg,#7c4dff,#5c2fff)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", boxShadow: prompt.trim() && !loading ? "0 4px 20px rgba(124,77,255,0.45)" : "none" }}>
          {loading
            ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}><Zap size={18} color="#fff" /></motion.div>
            : <Sparkles size={18} color={prompt.trim() ? "#fff" : "#444"} />}
        </motion.button>
      </div>

      {/* Result feedback */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 10, overflow: "hidden" }}>
            <div style={{ padding: "7px 12px", borderRadius: 10, background: result.applied ? "rgba(30,217,154,0.08)" : "rgba(255,79,106,0.08)", border: `1px solid ${result.applied ? "rgba(30,217,154,0.22)" : "rgba(255,79,106,0.22)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {result.applied ? <Check size={12} color="#1ed99a" /> : <X size={12} color="#ff4f6a" />}
                <span style={{ fontSize: 12, fontWeight: 600, color: result.applied ? "#1ed99a" : "#ff4f6a" }}>
                  {result.applied ? result.label || "Applied" : `Error: ${result.error}`}
                </span>
              </div>
              {result.applied && result.diff && (
                <button onClick={() => setShowDiff(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#4a4a6a", display: "flex", alignItems: "center", gap: 2, fontSize: 10, fontFamily: font }}>
                  details {showDiff ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              )}
            </div>
            <AnimatePresence>
              {showDiff && result.diff && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  style={{ padding: "7px 12px", marginTop: 4, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                  {diffSummary(result.diff).map((line, i) => (
                    <p key={i} style={{ margin: "1px 0", fontSize: 11, color: "#4a4a62", fontFamily: font }}>· {line}</p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && (
        <p style={{ margin: "9px 0 0", fontSize: 10, color: "#2e2e45", textAlign: "center", fontFamily: font }}>
          Enter ↵ to apply · system auto-selects local or AI engine · fully reversible
        </p>
      )}
    </motion.div>
  );
}
