#!/usr/bin/env node
// Draw spirals with known answers and check what the analysis says about them.
//
//   node scripts/synthetic-spirals.mjs                      # JS width metrics only (offline)
//   node scripts/synthetic-spirals.mjs --backend matlab     # also call the MATLAB backend directly
//   node scripts/synthetic-spirals.mjs --backend batch --batch-url https://www.spiralanalysis.com
//                                                           # go through the batch API (needs BATCH_API_KEY)
//
// Options: --out <dir> (default data-comparison/synthetic), --repeats <n> (default 5),
//          --concurrency <n> (default 4, matlab only)
//
// Writes <out>/results.csv, <out>/stability.csv and <out>/gallery.html.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SPIRAL_PRESETS, generateSpiral, stabilitySet } from "../src/lib/syntheticSpiral.js";
import { prepareDrawData } from "../src/lib/spiralPreprocess.js";
import { computeWidthMetrics } from "../src/lib/widthMetrics.js";

const MATLAB_URL = process.env.MATLAB_BACKEND_URL || "https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const backend = arg("backend", "local");
const outDir = resolve(arg("out", "data-comparison/synthetic"));
const repeats = Number(arg("repeats", 5));
const concurrency = Number(arg("concurrency", 4));
const batchUrl = arg("batch-url", null);

// ---------------------------------------------------------------------------
// Build the set
// ---------------------------------------------------------------------------

const cases = [
  ...Object.entries(SPIRAL_PRESETS).map(([name, options]) => ({ name, group: "preset", options })),
  ...stabilitySet({ noiseCm: 0.01 }, repeats).map((s) => ({ ...s, group: "stability" })),
].map((c) => {
  const spiral = generateSpiral(c.options);
  const drawData = prepareDrawData(spiral.points, spiral.cssPpi);
  return { ...c, spiral, drawData, js: computeWidthMetrics(drawData) || {}, backend: null, error: null };
});

// ---------------------------------------------------------------------------
// Run through a backend
// ---------------------------------------------------------------------------

async function callMatlab(drawData) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(MATLAB_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(drawData),
        signal: AbortSignal.timeout(90_000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

async function runMatlab() {
  let next = 0;
  let finished = 0;
  async function lane() {
    while (next < cases.length) {
      const c = cases[next++];
      const t0 = Date.now();
      try {
        c.backend = await callMatlab(c.drawData);
      } catch (err) {
        c.error = err.message;
      }
      finished += 1;
      console.log(`[${finished}/${cases.length}] ${c.name}: ${c.error ? `ERROR ${c.error}` : `${((Date.now() - t0) / 1000).toFixed(1)}s`}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
}

async function runBatch() {
  const key = process.env.BATCH_API_KEY;
  if (!batchUrl || !key) throw new Error("--backend batch needs --batch-url and the BATCH_API_KEY environment variable");
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const submit = await fetch(`${batchUrl}/api/batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      label: "synthetic spirals",
      useCache: false,
      drawings: cases.map((c) => ({ ref: c.name, points: c.spiral.points, cssPpi: c.spiral.cssPpi })),
    }),
  });
  const batch = await submit.json();
  if (!submit.ok) throw new Error(`Submit failed: ${JSON.stringify(batch)}`);
  console.log(`Batch ${batch.batchId}: ${batch.totalItems} rows`);

  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await (await fetch(batch.links.status, { headers })).json();
    console.log(`  ${s.percent}%  ${JSON.stringify(s.counts)}`);
    if (s.status === "completed") break;
  }

  let offset = 0;
  while (offset != null) {
    const page = await (await fetch(`${batch.links.results}?offset=${offset}&limit=1000`, { headers })).json();
    for (const item of page.items) {
      const c = cases.find((x) => x.name === item.ref);
      if (!c) continue;
      if (item.status === "done") c.backend = item.result;
      else c.error = `${item.status}: ${item.error}`;
    }
    offset = page.nextOffset;
  }
}

if (backend === "matlab") await runMatlab();
else if (backend === "batch") await runBatch();
else if (backend !== "local") throw new Error(`Unknown --backend ${backend}`);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const num = (v) => {
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const fmt = (v, d = 3) => (num(v) == null ? (v == null ? "" : String(v)) : num(v).toFixed(d));

const backendKeys = [...new Set(cases.flatMap((c) => Object.keys(c.backend || {})))].sort();
const truthKeys = Object.keys(cases[0].spiral.truth);
const jsKeys = Object.keys(cases.find((c) => Object.keys(c.js).length)?.js || {});

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

mkdirSync(outDir, { recursive: true });

const header = ["name", "group", ...truthKeys.map((k) => `truth:${k}`), ...jsKeys.map((k) => `js:${k}`), ...backendKeys, "error"];
const rows = cases.map((c) => [
  c.name,
  c.group,
  ...truthKeys.map((k) => c.spiral.truth[k]),
  ...jsKeys.map((k) => c.js[k]),
  ...backendKeys.map((k) => c.backend?.[k]),
  c.error,
]);
writeFileSync(join(outDir, "results.csv"), [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");

// Stability: spread of each metric across repeats of the same spiral.
const repeatsDone = cases.filter((c) => c.group === "stability");
const stability = [...jsKeys.map((k) => ({ key: `js:${k}`, get: (c) => c.js[k] })), ...backendKeys.map((k) => ({ key: k, get: (c) => c.backend?.[k] }))]
  .map(({ key, get }) => {
    const values = repeatsDone.map(get).map(num).filter((v) => v != null);
    if (values.length < 2) return { key, n: values.length, mean: null, sd: null, cv: null };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
    return { key, n: values.length, mean, sd, cv: mean !== 0 ? Math.abs(sd / mean) : sd === 0 ? 0 : Infinity };
  })
  .sort((a, b) => (b.cv ?? -1) - (a.cv ?? -1));
writeFileSync(
  join(outDir, "stability.csv"),
  ["metric,n,mean,sd,cv", ...stability.map((s) => [s.key, s.n, s.mean, s.sd, s.cv].map(csvCell).join(","))].join("\r\n") + "\r\n"
);

// Console summary: what went in vs what came out.
const W = "overall average of widths";
console.log("\nname                     spacing  JS width  backend width  loops  backend cycles");
for (const c of cases) {
  console.log(
    [
      c.name.padEnd(24),
      fmt(c.spiral.truth.loopSpacingCm, 2).padStart(7),
      fmt(c.js[W]).padStart(9),
      fmt(c.backend?.[W]).padStart(14),
      String(c.spiral.truth.loops).padStart(6),
      fmt(c.backend?.["number of cycles"], 1).padStart(15),
      c.error ? `  ERROR ${c.error}` : "",
    ].join(" ")
  );
}

// Gallery: every spiral as drawn, with its answer and the measured values.
const HEADLINE = [
  [W, "loopSpacingCm"],
  ["number of cycles", "loops"],
  ["Sampling frequency", "sampleHz"],
  ["Speed mean", "meanSpeedCmPerS"],
  ["Cal Tremor", "tremorFreqHz"],
  ["traxis_fr1", "tremorFreqHz"],
  ["mean amp. (cm)", "tremorAmplitudeCm"],
  ["traxis_dir1", "tremorAxisDeg"],
  ["DOS", null],
  ["Tightness", null],
  ["2nd order sm", null],
  ["2nd order z cr", null],
];

function svgFor(c) {
  const size = c.spiral.options.canvasCm * (c.spiral.cssPpi / 2.54);
  const d = c.spiral.points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const first = c.spiral.points[0];
  return `<svg viewBox="0 0 ${size.toFixed(0)} ${size.toFixed(0)}" role="img" aria-label="${c.name}">
<rect x="0" y="0" width="${size.toFixed(0)}" height="${size.toFixed(0)}" class="bg"/>
<path d="${d}" class="ink"/><circle cx="${first.x}" cy="${first.y}" r="5" class="start"/></svg>`;
}

function tableFor(c) {
  const lines = HEADLINE.map(([key, truthKey]) => {
    const truth = truthKey ? c.spiral.truth[truthKey] : null;
    const measured = key === W && c.backend?.[key] == null ? c.js[key] : c.backend?.[key];
    const source = key === W && c.backend?.[key] == null ? " (JS)" : "";
    if (measured == null && truth == null) return "";
    return `<tr><th>${key}${source}</th><td>${truth == null ? "—" : fmt(truth, 2)}</td><td>${fmt(measured)}</td></tr>`;
  }).join("");
  return `<table><tr><th></th><th>put in</th><th>measured</th></tr>${lines}</table>`;
}

const cards = cases
  .map(
    (c) => `<figure>${svgFor(c)}<figcaption><h2>${c.name}</h2>
<p>${c.spiral.truth.loops} loops · ${c.spiral.truth.loopSpacingCm} cm apart · ${c.spiral.truth.durationS}s · ${c.spiral.truth.sampleHz} Hz${
      c.spiral.truth.tremorFreqHz ? ` · tremor ${c.spiral.truth.tremorFreqHz} Hz, ${c.spiral.truth.tremorAmplitudeCm} cm` : ""
    }</p>${c.error ? `<p class="err">${c.error}</p>` : ""}${tableFor(c)}</figcaption></figure>`
  )
  .join("\n");

writeFileSync(
  join(outDir, "gallery.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic spirals</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:light dark;--fg:#1f1f1c;--muted:#6b6a64;--line:#d9d7cf;--bg:#fbfaf7;--card:#fff;--ink:#2a5fa5;--err:#a32d2d}
@media (prefers-color-scheme:dark){:root{--fg:#ecebe6;--muted:#a3a29b;--line:#3a3a37;--bg:#1d1d1b;--card:#262624;--ink:#85b7eb;--err:#f09595}}
body{font:14px/1.5 system-ui,sans-serif;color:var(--fg);background:var(--bg);margin:0;padding:24px}
h1{font-size:20px;font-weight:500;margin:0 0 4px}p.lead{color:var(--muted);margin:0 0 20px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
svg{width:100%;height:auto;display:block}.bg{fill:none;stroke:var(--line)}.ink{fill:none;stroke:var(--ink);stroke-width:2}.start{fill:var(--err)}
h2{font-size:15px;font-weight:500;margin:8px 0 2px}figcaption p{color:var(--muted);margin:0 0 6px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}th,td{padding:2px 4px;border-top:1px solid var(--line);text-align:right}th:first-child{text-align:left;font-weight:400;color:var(--muted)}
.err{color:var(--err)!important}
</style></head><body>
<h1>Synthetic spirals</h1>
<p class="lead">Drawn by algorithm with known answers · backend: ${backend} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · red dot = where the pen starts</p>
<main>${cards}</main></body></html>`
);

console.log(`\nWrote ${join(outDir, "results.csv")}, stability.csv and gallery.html`);
