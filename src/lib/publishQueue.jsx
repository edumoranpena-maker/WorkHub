/**
 * publishQueue.jsx
 *
 * Global, in-memory publish queue.
 *
 * Deliberately simple, per product decision: jobs live only in React state
 * (no persistence). If the user closes the tab or refreshes mid-publish,
 * the job is lost — that's the accepted tradeoff for keeping this simple.
 * While the app stays open, the user can navigate anywhere and the job
 * keeps running and reporting progress via <PublishProgressBar />.
 *
 * Usage:
 *   const { enqueue } = usePublishQueue();
 *   enqueue("Publicando post…", async () => {
 *     const saved = await createRecapThread(...);
 *     if (saved) prependToFeed(saved);
 *   });
 */

import { createContext, useContext, useState, useCallback, useRef } from "react";

const PublishQueueContext = createContext(null);

export function PublishQueueProvider({ children }) {
  const [jobs, setJobs] = useState([]); // [{ id, label, status: 'running'|'done'|'error' }]
  const idRef = useRef(0);

  const enqueue = useCallback((label, task) => {
    const id = ++idRef.current;
    setJobs(prev => [...prev, { id, label, status: "running" }]);

    Promise.resolve()
      .then(task)
      .then(() => {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "done" } : j));
        setTimeout(() => setJobs(prev => prev.filter(j => j.id !== id)), 1400);
      })
      .catch((err) => {
        console.error(`[publishQueue] "${label}" failed:`, err);
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: "error" } : j));
        setTimeout(() => setJobs(prev => prev.filter(j => j.id !== id)), 3200);
      });

    return id;
  }, []);

  return (
    <PublishQueueContext.Provider value={{ jobs, enqueue }}>
      {children}
    </PublishQueueContext.Provider>
  );
}

export function usePublishQueue() {
  const ctx = useContext(PublishQueueContext);
  if (!ctx) throw new Error("usePublishQueue() must be used inside <PublishQueueProvider>");
  return ctx;
}
