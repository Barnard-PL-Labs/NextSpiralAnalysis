// Batches in the spiral lab: "N copies of this type, M of that type", expanded
// into individual spirals, run through the analysis, and summarised per type.
import { DEFAULT_SPIRAL, generateSpiral } from "@/lib/syntheticSpiral";
import { compareToTruth, optionsToSettings, settingsToOptions, toNumber } from "@/lib/spiralLab";

export const MAX_COPIES = 50;
export const MAX_BATCH = 200;
// How many spirals are analyzed at once from the browser.
export const BATCH_CONCURRENCY = 4;
// Measured 2026-11-25: one MATLAB call takes about 30-60 s.
const SECONDS_PER_SPIRAL = 35;
// Hand jitter added to copies of a spiral that has none, so the copies differ.
export const COPY_JITTER_CM = 0.01;

// One line of the batch: { id, label, presetId|null, settings, copies }.
export function expandBatch(items, { varyCopies = true } = {}) {
  return items.flatMap((item) =>
    Array.from({ length: item.copies }, (_, i) => {
      let settings = { ...item.settings, seed: item.settings.seed + i };
      const addedJitter = varyCopies && item.copies > 1 && settings.noise === 0 && settings.timingJitter === 0;
      if (addedJitter) settings = { ...settings, noise: COPY_JITTER_CM };
      return { key: `${item.id}:${i + 1}`, itemId: item.id, label: item.label, presetId: item.presetId ?? null, copy: i + 1, settings, addedJitter };
    })
  );
}

export function countSpirals(items) {
  return items.reduce((n, item) => n + item.copies, 0);
}

export function estimateMinutes(count, concurrency = BATCH_CONCURRENCY) {
  return (Math.ceil(count / concurrency) * SECONDS_PER_SPIRAL) / 60;
}

function stats(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return { n: 0, mean: null, sd: null };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sd = nums.length > 1 ? Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1)) : null;
  return { n: nums.length, mean, sd };
}

// Checks against what was set, as in the single-spiral view.
const CHECKS = [
  { name: "spacing", key: "overall average of widths" },
  { name: "loops", key: "number of cycles" },
  { name: "tremorDetected", key: "Cal Tremor" },
  { name: "tremorFreq", key: "traxis_fr1" },
];
// Metrics with no "right answer": the spread across copies shows how stable they are.
export const SPREAD_METRICS = ["DOS", "Tightness", "1st order sm", "2nd order sm"];

// Per batch line: progress, how often each check matched, and mean ± sd.
export function summarizeBatch(items, jobs) {
  return items.map((item) => {
    const mine = jobs.filter((j) => j.itemId === item.id);
    const done = mine.filter((j) => j.status === "done");
    // With no known answer (uploaded drawings), report only what was found.
    const compared = done.map((j) =>
      j.truth
        ? compareToTruth(j.result, j.truth)
        : CHECKS.map(({ key }) => ({ key, truth: null, measured: toNumber(j.result?.[key]), verdict: null }))
    );
    const checks = Object.fromEntries(
      CHECKS.map(({ name, key }) => {
        const rows = compared.map((rs) => rs.find((r) => r.key === key));
        const judged = rows.filter((r) => r?.verdict);
        return [
          name,
          {
            truth: rows[0]?.truth ?? null,
            ...stats(rows.map((r) => r?.measured ?? null)),
            judged: judged.length,
            matched: judged.filter((r) => r.verdict === "match").length,
          },
        ];
      })
    );
    const spread = Object.fromEntries(SPREAD_METRICS.map((k) => [k, stats(done.map((j) => toNumber(j.result?.[k])))]));
    return {
      item,
      total: mine.length,
      done: done.length,
      failed: mine.filter((j) => j.status === "failed").length,
      hasTruth: mine.some((j) => j.truth),
      checks,
      spread,
    };
  });
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per spiral: what it was, what was set, what came back.
export function batchToCsv(jobs) {
  const finished = jobs.filter((j) => j.status === "done" || j.status === "failed");
  if (!finished.length) return "";
  const settingKeys = Object.keys(finished[0].settings);
  const truthKeys = [...new Set(finished.flatMap((j) => Object.keys(j.truth || {})))];
  const metricKeys = [...new Set(finished.flatMap((j) => Object.keys(j.result || {})))].sort();
  const header = [
    "type",
    "preset",
    "copy",
    "status",
    "error",
    "seconds",
    "added_jitter",
    ...settingKeys.map((k) => `setting:${k}`),
    ...truthKeys.map((k) => `truth:${k}`),
    ...metricKeys,
  ];
  const rows = finished.map((j) => [
    j.label,
    j.presetId,
    j.copy,
    j.status,
    j.error,
    j.seconds?.toFixed(1),
    j.addedJitter,
    ...settingKeys.map((k) => j.settings[k]),
    ...truthKeys.map((k) => j.truth?.[k]),
    ...metricKeys.map((k) => j.result?.[k]),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Everything needed to re-run or re-analyze the batch elsewhere, points included.
export function batchToJson(jobs) {
  return JSON.stringify(
    {
      generator: "src/lib/syntheticSpiral.js",
      spirals: jobs.map((j) => {
        const spiral = generateSpiral(settingsToOptions(j.settings));
        return {
          type: j.label,
          preset: j.presetId,
          copy: j.copy,
          settings: settingsToOptions(j.settings),
          truth: spiral.truth,
          cssPpi: spiral.cssPpi,
          points: spiral.points,
          status: j.status,
          result: j.result ?? null,
        };
      }),
    },
    null,
    1
  );
}

// ---------------------------------------------------------------------------
// Batch API (/api/batch, "synthetic" recipes)
// ---------------------------------------------------------------------------

// Type names must be unique within a batch, since results are grouped by them.
function uniqueLabels(items) {
  const seen = new Map();
  return items.map((item) => {
    const base = (item.label || "Unnamed").trim().slice(0, 180) || "Unnamed";
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return { ...item, label: n === 1 ? base : `${base} (${n})` };
  });
}

// The request body's `synthetic` list: one recipe per copy, carrying the type
// name, so the server's results can be grouped without anything kept here.
export function toApiSpirals(items, { varyCopies = true } = {}) {
  return expandBatch(uniqueLabels(items), { varyCopies }).map((j) => ({
    ref: `${j.label} #${j.copy}`,
    label: j.label,
    options: settingsToOptions(j.settings),
  }));
}

// Rebuild the per-type view from the server's result rows alone.
export function jobsFromServerRows(rows) {
  const jobs = rows.map((row, i) => {
    const options = { ...DEFAULT_SPIRAL, ...(row.spec || {}) };
    const settings = optionsToSettings(options);
    const label = row.label || "Unnamed";
    const copy = Number((row.ref || "").match(/#(\d+)$/)?.[1]) || i + 1;
    const finished = row.status === "done" || row.status === "failed" || row.status === "skipped";
    let truth;
    if (finished && row.spec) {
      try {
        truth = generateSpiral(options).truth;
      } catch {
        truth = undefined;
      }
    }
    return {
      key: row.ref || String(i),
      itemId: label,
      label,
      presetId: null,
      copy,
      settings,
      status: row.status === "skipped" ? "failed" : row.status,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      seconds: row.duration_ms != null ? row.duration_ms / 1000 : undefined,
      // When a running row was claimed, for the live "running for" clock.
      since: row.status === "running" ? row.updated_at : undefined,
      truth,
    };
  });
  const items = [];
  for (const job of jobs) {
    const item = items.find((it) => it.id === job.itemId);
    if (item) item.copies += 1;
    else items.push({ id: job.itemId, label: job.label, presetId: null, settings: job.settings, copies: 1 });
  }
  return { items, jobs };
}
