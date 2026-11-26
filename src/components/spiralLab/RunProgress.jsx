"use client";
// Live view of a running batch: overall counts and elapsed time, then one row
// per spiral type with a dot per copy (waiting / running / done / failed), so
// it is obvious from the first second that work is happening.
import { useEffect, useState } from "react";
import styles from "@/styles/SpiralLab.module.css";

const STATES = [
  { key: "queued", label: "Waiting", cls: "dotQueued" },
  { key: "running", label: "Running", cls: "dotRunning" },
  { key: "done", label: "Done", cls: "dotDone" },
  { key: "failed", label: "Failed", cls: "dotFailed" },
  { key: "stopped", label: "Stopped", cls: "dotQueued" },
];
const STATE = Object.fromEntries(STATES.map((s) => [s.key, s]));
// Above this many copies in one row, show a stacked bar instead of one dot each.
const MAX_DOTS = 40;

function clock(ms) {
  if (!(ms >= 0)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function RunProgress({ jobs, items, active, source }) {
  const finishedRun = active?.status === "completed" || (source === "local" && !jobs.some((j) => j.status === "running" || j.status === "queued"));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (finishedRun) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finishedRun]);

  if (!jobs.length) {
    return active ? (
      <section className={styles.card} aria-live="polite">
        <p className={styles.status}>Connecting to batch “{active.label}”…</p>
      </section>
    ) : null;
  }

  const counts = Object.fromEntries(STATES.map((s) => [s.key, jobs.filter((j) => j.status === s.key).length]));
  const settled = counts.done + counts.failed;
  const started = active?.createdAt ? Date.parse(active.createdAt) : null;
  const ended = active?.finishedAt ? Date.parse(active.finishedAt) : null;
  const elapsed = started ? (ended ?? (finishedRun ? started : now)) - started : null;

  return (
    <section className={styles.card} aria-label="Batch progress" aria-live="polite">
      <div className={styles.sectionTitle}>
        <span>
          {source === "api" ? `Batch “${active?.label ?? ""}” · on the server` : "Running in this tab"}
        </span>
        <span>
          <span className={`${styles.badge} ${finishedRun ? styles.good : styles.runningBadge}`}>
            {finishedRun ? "Finished" : "Running"}
          </span>
          {elapsed != null && elapsed > 0 && <span className={styles.timeBadge}>{clock(elapsed)}</span>}
        </span>
      </div>

      <div className={styles.progressWrap} style={{ marginTop: 0 }}>
        <div className={styles.progressBar}>
          <div style={{ width: `${(settled / jobs.length) * 100}%` }} />
        </div>
        <span className={styles.status}>
          {settled} of {jobs.length}
        </span>
      </div>

      <div className={styles.countRow}>
        {STATES.filter((s) => counts[s.key] > 0 || ["queued", "running", "done"].includes(s.key)).map((s) => (
          <span key={s.key} className={styles.countChip}>
            <span className={`${styles.dot} ${styles[s.cls]}`} />
            {s.label} <strong>{counts[s.key]}</strong>
          </span>
        ))}
      </div>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <tbody>
            {items.map((item) => {
              const mine = jobs.filter((j) => j.itemId === item.id).sort((a, b) => a.copy - b.copy);
              const running = mine.filter((j) => j.status === "running");
              const longest = running.reduce((m, j) => Math.max(m, j.since ? now - Date.parse(j.since) : 0), 0);
              const done = mine.filter((j) => j.status === "done").length;
              return (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>
                    {mine.length > MAX_DOTS ? (
                      <span className={styles.miniBar} title={STATES.map((st) => `${st.label} ${mine.filter((j) => j.status === st.key).length}`).join(" · ")}>
                        {STATES.map((st) => {
                          const n = mine.filter((j) => j.status === st.key).length;
                          return n ? <span key={st.key} className={styles[st.cls]} style={{ width: `${(n / mine.length) * 100}%` }} /> : null;
                        })}
                      </span>
                    ) : (
                    <span className={styles.dots}>
                      {mine.map((j) => (
                        <span
                          key={j.key}
                          className={`${styles.dot} ${styles[STATE[j.status]?.cls ?? "dotQueued"]}`}
                          title={`Copy ${j.copy}: ${STATE[j.status]?.label ?? j.status}${j.error ? ` (${j.error})` : ""}`}
                        />
                      ))}
                    </span>
                    )}
                  </td>
                  <td className={styles.status}>
                    {done}/{mine.length} done
                    {running.length > 0 && ` · ${running.length} running${longest > 0 ? ` (${clock(longest)})` : ""}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!finishedRun && (
        <p className={styles.footnote}>
          {source === "api"
            ? "Each spiral takes about 30–60 s in MATLAB, and up to 20 run at once on the server. This updates every 5 s; you can leave the page and come back to it under “Sent batches”."
            : "Each spiral takes about 30–60 s in MATLAB, 4 at a time from this tab. Keep the tab open."}
        </p>
      )}
    </section>
  );
}
