/**
 * PublishProgressBar.jsx
 *
 * Fixed bar at the bottom of the screen showing background publish jobs
 * from publishQueue.jsx. Mounted once near the app root so it stays visible
 * across navigation (Post, Announcements, custom sections, etc).
 */

import { AnimatePresence, motion } from "framer-motion";
import { Loader, Check, AlertTriangle } from "lucide-react";
import { usePublishQueue } from "../lib/publishQueue.jsx";

const font = "'DM Sans', sans-serif";
const C = {
  text: "#fafafa", textMuted: "#8e8e8e",
  teal: "#22d3a0", red: "#ff4f6a",
};

export default function PublishProgressBar() {
  const { jobs } = usePublishQueue();

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 3500,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "0 16px calc(14px + env(safe-area-inset-bottom, 0px))",
      pointerEvents: "none",
    }}>
      <AnimatePresence>
        {jobs.map(job => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            style={{
              pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10,
              background: "rgba(19,19,31,0.96)", backdropFilter: "blur(20px)",
              border: `1px solid ${job.status === "error" ? C.red + "55" : C.teal + "40"}`,
              borderRadius: 99, padding: "9px 16px 9px 12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {job.status === "running" && <Loader size={14} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />}
            {job.status === "done" && <Check size={14} color={C.teal} />}
            {job.status === "error" && <AlertTriangle size={14} color={C.red} />}
            <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: job.status === "error" ? C.red : C.text, whiteSpace: "nowrap" }}>
              {job.status === "running" && job.label}
              {job.status === "done" && "Publicado ✓"}
              {job.status === "error" && "No se pudo publicar"}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
