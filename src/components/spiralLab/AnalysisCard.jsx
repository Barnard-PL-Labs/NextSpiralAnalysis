"use client";
// "Did the analysis get it right?": what you set next to what the analysis
// found. The simple view shows the few checks that matter most; the detailed
// view shows them all plus every value the backend returned.
import styles from "@/styles/SpiralLab.module.css";
import { compareToTruth, describeSpiral, simpleRows, toNumber } from "@/lib/spiralLab";

const VERDICT = {
  match: ["Matches", styles.good],
  off: ["Off", styles.warn],
  missing: ["No value", styles.bad],
};

export function fmt(value, digits = 2) {
  const n = toNumber(value);
  if (n == null) return value == null || value === "" ? "—" : String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

// Yes/no for the tremor flag, number and unit for everything else.
function show(row, value) {
  if (value == null) return "—";
  if (row.key === "Cal Tremor") return Number(value) === 1 ? "Yes" : "No";
  return `${fmt(value)} ${row.unit}`.trim();
}

export default function AnalysisCard({ analysis, now, stale, simple, onOpenDetailed }) {
  if (!analysis) return null;

  const done = analysis.status === "done";
  const allRows = done ? compareToTruth(analysis.result, analysis.truth) : [];
  const rows = done && simple ? simpleRows(allRows, analysis.truth) : allRows;
  const judged = rows.filter((r) => r.verdict);
  const matched = judged.filter((r) => r.verdict === "match").length;

  return (
    <section className={styles.card} aria-label="Analysis" aria-live="polite">
      <div className={styles.sectionTitle}>
        <span>Did the analysis get it right?</span>
        {analysis.status === "done" && <span>{analysis.seconds.toFixed(0)} s</span>}
      </div>

      {analysis.status === "running" && (
        <p className={styles.status}>
          Analyzing… {Math.round((now - analysis.startedAt) / 1000)} s. This usually takes 30–60 seconds.
        </p>
      )}
      {analysis.status === "error" && <div className={styles.error}>{analysis.error}</div>}

      {analysis.status === "done" && (
        <>
          <p className={styles.verdictLine}>
            <span className={`${styles.badge} ${matched === judged.length ? styles.good : styles.warn}`}>
              {matched} of {judged.length} match
            </span>
            {stale && <span className={styles.status}> For the spiral you analyzed: {describeSpiral(analysis.settings)}</span>}
          </p>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>What</th>
                  <th>You set</th>
                  <th>Analysis found</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.label}
                      {!simple && <div className={styles.hint}>{row.key}</div>}
                    </td>
                    <td>{show(row, row.truth)}</td>
                    <td>{row.measured == null ? fmt(row.raw) : show(row, row.measured)}</td>
                    <td>{row.verdict && <span className={`${styles.badge} ${VERDICT[row.verdict][1]}`}>{VERDICT[row.verdict][0]}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {simple ? (
            <button type="button" className={`${styles.linkButton} ${styles.moreLink}`} onClick={onOpenDetailed}>
              See all {Object.keys(analysis.result).length} values in the detailed view →
            </button>
          ) : (
            <>
              <p className={styles.footnote}>
                Loop spacing comes from the site&apos;s JavaScript port (
                {analysis.jsWidths ? `${fmt(analysis.jsWidths["overall average of widths"], 3)} cm` : "no value"}) whenever MATLAB
                returns &quot;No Axis&quot;, exactly as for real drawings. &quot;Matches&quot; means within 10% (5% for sample rate, 15%
                for speed, ±0.5 loops, ±15° for direction).
              </p>
              <details className={styles.details}>
                <summary>All {Object.keys(analysis.result).length} values the analysis returned</summary>
                <div className={styles.metricsGrid}>
                  {Object.entries(analysis.result)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <span>{typeof v === "object" ? "…" : fmt(v, 3)}</span>
                      </div>
                    ))}
                </div>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
