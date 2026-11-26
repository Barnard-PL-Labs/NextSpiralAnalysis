"use client";
// Every analysis run this session, side by side, for comparing how metrics
// move as one setting changes.
import styles from "@/styles/SpiralLab.module.css";
import { fmt } from "@/components/spiralLab/AnalysisCard";
import { describeSpiral } from "@/lib/spiralLab";

const RUN_KEYS = ["DOS", "Tightness", "1st order sm", "2nd order sm", "number of cycles", "traxis_fr1"];

function cell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runsToCsv(runs) {
  const metricKeys = [...new Set(runs.flatMap((r) => Object.keys(r.result || {})))].sort();
  const truthKeys = Object.keys(runs[0].truth);
  const settingKeys = Object.keys(runs[0].settings);
  const header = [...settingKeys.map((k) => `setting:${k}`), ...truthKeys.map((k) => `truth:${k}`), "seconds", ...metricKeys];
  const lines = runs.map((r) =>
    [...settingKeys.map((k) => r.settings[k]), ...truthKeys.map((k) => r.truth[k]), r.seconds.toFixed(1), ...metricKeys.map((k) => r.result[k])]
      .map(cell)
      .join(",")
  );
  return [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
}

export default function RunsCard({ runs, onLoad, onDownload }) {
  if (!runs.length) return null;
  return (
    <section className={styles.card} aria-label="Runs this session">
      <div className={styles.sectionTitle}>
        <span>Runs this session</span>
        <button type="button" className={styles.button} onClick={onDownload}>
          Download all (CSV)
        </button>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Spiral</th>
              <th>Spacing set / found</th>
              {RUN_KEYS.map((k) => (
                <th key={k}>{k}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td style={{ minWidth: 220 }}>{describeSpiral(r.settings)}</td>
                <td>
                  {fmt(r.truth.loopSpacingCm)} / {fmt(r.result["overall average of widths"])}
                </td>
                {RUN_KEYS.map((k) => (
                  <td key={k}>{fmt(r.result[k])}</td>
                ))}
                <td>
                  <button type="button" className={styles.button} onClick={() => onLoad(r.settings)}>
                    Load
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
