"use client";
// "Results by type": one row per spiral type (or upload group), mean ± spread
// of the key metrics. For synthetic spirals, badges show how many copies
// matched what was set; uploaded drawings have no known answer, so their
// rows show only what the analysis found.
import styles from "@/styles/SpiralLab.module.css";
import { fmt } from "@/components/spiralLab/AnalysisCard";
import { SPREAD_METRICS } from "@/lib/spiralBatch";

const OTHER_SPREAD = SPREAD_METRICS.filter((k) => k !== "DOS");

function Badge({ matched, judged }) {
  if (!judged) return null;
  const cls = matched === judged ? styles.good : matched === 0 ? styles.bad : styles.warn;
  return (
    <span className={`${styles.badge} ${cls}`} title={`${matched} of ${judged} matched what was set`}>
      {matched}/{judged}
    </span>
  );
}

function MeanSd({ s, unit = "" }) {
  if (!s || s.mean == null) return <>—</>;
  return (
    <>
      {fmt(s.mean)}
      {s.sd != null && <span className={styles.sd}> ±{fmt(s.sd)}</span>}
      {unit && ` ${unit}`}
    </>
  );
}

export default function BatchResults({ summary, title = "Results by type", groupLabel = "Type", actions = null, note = null }) {
  if (!summary.some((s) => s.done > 0 || s.failed > 0)) return null;
  const anyTruth = summary.some((s) => s.hasTruth);

  return (
    <section className={styles.card} aria-label="Batch results">
      <div className={styles.sectionTitle}>
        <span>{title}</span>
        {actions && <span className={styles.headerActions}>{actions}</span>}
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{groupLabel}</th>
              <th>Done</th>
              <th>DOS</th>
              <th>Spacing</th>
              <th>Loops</th>
              <th>Tremor</th>
              {OTHER_SPREAD.map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map(({ item, total: n, done, failed: f, checks, spread, hasTruth }) => (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>
                  {done}/{n}
                  {f > 0 && <div className={styles.limitOver}>{f} failed</div>}
                </td>
                <td className={styles.keyCell}>
                  <MeanSd s={spread.DOS} />
                </td>
                <td>
                  <MeanSd s={checks.spacing} unit="cm" /> <Badge {...checks.spacing} />
                  {checks.spacing.truth != null && <div className={styles.hint}>set {fmt(checks.spacing.truth)} cm</div>}
                </td>
                <td>
                  <MeanSd s={checks.loops} /> <Badge {...checks.loops} />
                  {checks.loops.truth != null && <div className={styles.hint}>set {fmt(checks.loops.truth)}</div>}
                </td>
                <td>
                  {!hasTruth ? (
                    <>
                      {checks.tremorFreq.mean != null ? <MeanSd s={checks.tremorFreq} unit="Hz" /> : "none found"}
                      {checks.tremorDetected.mean != null && (
                        <div className={styles.hint}>found in {Math.round(checks.tremorDetected.mean * 100)}%</div>
                      )}
                    </>
                  ) : checks.tremorFreq.truth != null ? (
                    <>
                      <MeanSd s={checks.tremorFreq} unit="Hz" /> <Badge {...checks.tremorFreq} />
                      <div className={styles.hint}>set {fmt(checks.tremorFreq.truth)} Hz</div>
                    </>
                  ) : (
                    <>
                      none found <Badge {...checks.tremorDetected} />
                      <div className={styles.hint}>set: no tremor</div>
                    </>
                  )}
                </td>
                {OTHER_SPREAD.map((k) => (
                  <td key={k}>
                    <MeanSd s={spread[k]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>
        {note ??
          (anyTruth
            ? "Values are the mean across copies, ± the standard deviation. Badges count how many copies matched what was set (within 10%, ±0.5 loops). A large ± on a metric for the same type means that metric is not stable. The CSV has every value for every spiral."
            : "Values are the mean across the group, ± the standard deviation. The CSV has every value for every drawing.")}
      </p>
    </section>
  );
}
