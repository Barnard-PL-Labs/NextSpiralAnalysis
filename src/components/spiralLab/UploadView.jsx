"use client";
// Upload view: drop JSON files (or whole folders) of drawings, in any of the
// layouts spiralImport.js understands. Everything is read in the browser;
// nothing is sent or saved until "Analyze". Analysis goes to the batch API in
// parts (POST /api/batch, then /api/batch/[id]/items), since one request is
// capped at 100 drawings / ~4.5 MB. Uploads are never written to `drawings`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@/styles/SpiralLab.module.css";
import { Section } from "@/components/spiralLab/Controls";
import { fmt } from "@/components/spiralLab/AnalysisCard";
import BatchResults from "@/components/spiralLab/BatchResults";
import PointsThumb from "@/components/spiralLab/PointsThumb";
import RunProgress from "@/components/spiralLab/RunProgress";
import SpiralPlayer from "@/components/spiralLab/SpiralPlayer";
import { supabase } from "@/lib/supabaseClient";
import { SUPPORTED_FORMATS, parseSpiralFile, splitIntoParts, toBatchDrawing } from "@/lib/spiralImport";
import { jobsFromServerRows, summarizeBatch } from "@/lib/spiralBatch";

const PAGE_SIZE = 48;
const MAX_DRAWINGS = 3000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const POLL_MS = 5000;
const KEY_METRICS = ["DOS", "overall average of widths", "number of cycles", "traxis_fr1", "Tightness", "1st order sm", "2nd order sm"];

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function accessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function apiError(status, body) {
  if (status === 401) return "Sign in with a researcher account to analyze uploads.";
  if (status === 403) return "This account is not a researcher (superuser) account.";
  if (status === 500 && /Supabase credentials|create the batch|add to the batch/i.test(body?.error || "")) {
    return "The batch API is not set up on this server yet (database tables or service role key missing).";
  }
  return body?.error || `The batch API answered ${status}.`;
}

// Files dropped on the page, including the contents of dropped folders.
async function filesFromDrop(dataTransfer) {
  const entries = [...(dataTransfer.items || [])].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return [...(dataTransfer.files || [])].map((file) => ({ file, path: file.name }));
  const out = [];
  const walk = async (entry, dir) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: dir ? `${dir}/${file.name}` : file.name });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, dir ? `${dir}/${entry.name}` : entry.name);
      }
    }
  };
  for (const entry of entries) await walk(entry, "");
  return out;
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per uploaded drawing: where it came from, then every metric.
function uploadsCsv(drawings, rowsByRef) {
  const metricKeys = [...new Set([...rowsByRef.values()].flatMap((r) => Object.keys(r.result || {})))].sort();
  const header = ["file", "drawing", "group", "points", "css_ppi", "notes", "status", "error", ...metricKeys];
  const lines = drawings.map((d) => {
    const r = rowsByRef.get(d.ref);
    return [d.path, d.name, d.group, d.points.length, d.cssPpiUsed, d.notes.join(" "), r?.status ?? (d.error ? "invalid" : "not sent"), r?.error ?? d.error, ...metricKeys.map((k) => r?.result?.[k])];
  });
  return [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export default function UploadView() {
  const [drawings, setDrawings] = useState([]); // parsed drawings
  const [fileErrors, setFileErrors] = useState([]); // { path, error }
  const [reading, setReading] = useState(null); // { done, total }
  const [defaultPpi, setDefaultPpi] = useState(132);
  const [groupBy, setGroupBy] = useState("folder");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");

  const [sending, setSending] = useState(null); // { part, parts }
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // { batchId, label, status, createdAt, finishedAt }
  const [rows, setRows] = useState([]); // server result rows
  const pollRef = useRef(null);
  const fileInput = useRef(null);
  const folderInput = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  // ------------------------------------------------------------- reading

  const readFiles = async (list) => {
    if (!list.length) return;
    setReading({ done: 0, total: list.length });
    setError(null);
    const found = [];
    const problems = [];
    const used = new Set(drawings.map((d) => d.ref));
    for (let i = 0; i < list.length; i += 1) {
      const { file, path } = list[i];
      if (found.length + drawings.length >= MAX_DRAWINGS) {
        problems.push({ path, error: `Skipped: at most ${MAX_DRAWINGS} drawings at a time.` });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push({ path, error: "Skipped: larger than 25 MB." });
        continue;
      }
      const base = file.name.replace(/\.(json|jsonl|ndjson|txt)$/i, "");
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      const { drawings: parsed, error: fileError } = parseSpiralFile(await file.text(), base);
      if (fileError) problems.push({ path, error: fileError });
      parsed.forEach((d, k) => {
        let ref = parsed.length > 1 ? `${path} · ${d.name}` : path;
        for (let n = 2; used.has(ref); n += 1) ref = `${path} (${n})`;
        used.add(ref);
        found.push({ ...d, id: `${Date.now()}-${i}-${k}`, ref, path, folder });
      });
      if (i % 20 === 0) setReading({ done: i + 1, total: list.length });
    }
    setDrawings((prev) => [...prev, ...found].slice(0, MAX_DRAWINGS));
    setFileErrors((prev) => [...prev, ...problems]);
    setReading(null);
    setPage(0);
  };

  const onPick = (e) => {
    const list = [...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    e.target.value = "";
    readFiles(list);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    readFiles(await filesFromDrop(e.dataTransfer));
  };

  const clearAll = () => {
    clearTimeout(pollRef.current);
    setDrawings([]);
    setFileErrors([]);
    setSelected(null);
    setRows([]);
    setActive(null);
    setError(null);
  };

  // Group name and the screen PPI each drawing will be analyzed with.
  const prepared = useMemo(
    () =>
      drawings.map((d) => ({
        ...d,
        group: groupBy === "all" ? "All uploads" : groupBy === "file" ? d.path : d.folder || "Uploads",
        cssPpiUsed: d.cssPpi ?? defaultPpi,
      })),
    [drawings, groupBy, defaultPpi]
  );
  const valid = prepared.filter((d) => !d.error);
  const withNotes = prepared.filter((d) => !d.error && d.notes.length).length;
  const shown = filter === "problems" ? prepared.filter((d) => d.error || d.notes.length) : prepared;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const current = prepared.find((d) => d.id === selected) ?? null;
  const rowsByRef = useMemo(() => new Map(rows.map((r) => [r.ref, r])), [rows]);

  // --------------------------------------------------------- analyzing

  const poll = useCallback(async (batchId, label) => {
    const token = await accessToken();
    if (!token) return setError(apiError(401));
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const sRes = await fetch(`/api/batch/${batchId}`, { headers });
      const status = await sRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error(apiError(sRes.status, status));
      const all = [];
      for (let offset = 0; offset != null; ) {
        const res = await fetch(`/api/batch/${batchId}/results?offset=${offset}&limit=1000`, { headers });
        const page_ = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(apiError(res.status, page_));
        all.push(...page_.items);
        offset = page_.nextOffset;
      }
      setRows(all);
      setActive({ batchId, label: status.label ?? label, status: status.status, createdAt: status.createdAt, finishedAt: status.finishedAt });
      if (status.status !== "completed") pollRef.current = setTimeout(() => poll(batchId, label), POLL_MS);
    } catch (err) {
      setError(err.message);
      pollRef.current = setTimeout(() => poll(batchId, label), POLL_MS * 3);
    }
  }, []);

  const analyze = async () => {
    if (!valid.length) return;
    setError(null);
    const token = await accessToken();
    if (!token) return setError(apiError(401));
    clearTimeout(pollRef.current);
    setRows([]);
    const label = name.trim() || `Upload · ${new Date().toLocaleString()}`;
    const parts = splitIntoParts(valid.map((d) => toBatchDrawing(d, { ref: d.ref, label: d.group, defaultPpi })));
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    let batchId = null;
    try {
      for (let i = 0; i < parts.length; i += 1) {
        setSending({ part: i + 1, parts: parts.length });
        const res = batchId
          ? await fetch(`/api/batch/${batchId}/items`, { method: "POST", headers, body: JSON.stringify({ drawings: parts[i] }) })
          : await fetch("/api/batch", { method: "POST", headers, body: JSON.stringify({ label, backends: ["matlab"], drawings: parts[i] }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Part ${i + 1} of ${parts.length}: ${apiError(res.status, body)}`);
        if (!batchId) {
          batchId = body.batchId;
          setActive({ batchId, label, status: "running" });
          poll(batchId, label); // progress shows while the remaining parts upload
        }
      }
    } catch (err) {
      setError(
        batchId
          ? `${err.message} The parts sent before this are still being analyzed.`
          : err.message
      );
    } finally {
      setSending(null);
    }
  };

  const { items: runItems, jobs } = useMemo(() => jobsFromServerRows(rows), [rows]);
  const summary = useMemo(() => (jobs.length ? summarizeBatch(runItems, jobs) : []), [runItems, jobs]);
  const busy = Boolean(sending) || Boolean(reading);

  // ------------------------------------------------------------- render

  return (
    <div className={styles.layout}>
      <aside className={styles.card} aria-label="Upload drawings">
        <Section title="Upload drawings">
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneOver : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <strong>Drop JSON files or folders here</strong>
            <span className={styles.hint}>Read in your browser; nothing is sent until you press Analyze.</span>
            <div className={styles.actions} style={{ justifyContent: "center" }}>
              <button type="button" className={styles.button} disabled={busy} onClick={() => fileInput.current?.click()}>
                Choose files
              </button>
              <button type="button" className={styles.button} disabled={busy} onClick={() => folderInput.current?.click()}>
                Choose a folder
              </button>
            </div>
            <input ref={fileInput} type="file" multiple accept=".json,.jsonl,.ndjson,.txt,application/json" hidden onChange={onPick} />
            <input ref={folderInput} type="file" multiple hidden webkitdirectory="" directory="" onChange={onPick} />
          </div>
          {reading && (
            <p className={styles.status}>
              Reading {reading.done} of {reading.total} files…
            </p>
          )}
          <details className={styles.details}>
            <summary>Which JSON layouts work?</summary>
            <ul className={styles.formatList}>
              {SUPPORTED_FORMATS.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </details>
        </Section>

        <Section title="How to read them">
          <div className={styles.field}>
            <div className={styles.fieldTop}>
              <label className={styles.label} htmlFor="upload-ppi">
                Screen pixels per inch
              </label>
              <input
                id="upload-ppi"
                className={styles.number}
                type="number"
                min={20}
                max={600}
                value={defaultPpi}
                onChange={(e) => Number(e.target.value) > 0 && setDefaultPpi(Number(e.target.value))}
              />
            </div>
            <div className={styles.hint}>
              For files that don&apos;t say. 132 = iPad (the drawing page&apos;s x/y are CSS pixels). Files with cssPpi / css_ppi use their own.
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Group results by</span>
            <div className={styles.segmented} role="group" aria-label="Group results by" style={{ marginTop: 6 }}>
              {[
                ["folder", "Folder"],
                ["file", "File"],
                ["all", "One group"],
              ].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={groupBy === v} disabled={busy} onClick={() => setGroupBy(v)}>
                  {l}
                </button>
              ))}
            </div>
            <div className={styles.hint}>E.g. drop a “patients” and a “controls” folder and compare them.</div>
          </div>
        </Section>

        {(drawings.length > 0 || fileErrors.length > 0) && (
          <Section title="What was found">
            <div className={styles.countRow}>
              <span className={styles.countChip}>
                <span className={`${styles.dot} ${styles.dotDone}`} /> Usable <strong>{valid.length}</strong>
              </span>
              {withNotes > 0 && (
                <span className={styles.countChip}>
                  <span className={`${styles.dot} ${styles.dotNote}`} /> With notes <strong>{withNotes}</strong>
                </span>
              )}
              {prepared.length - valid.length + fileErrors.length > 0 && (
                <span className={styles.countChip}>
                  <span className={`${styles.dot} ${styles.dotFailed}`} /> Not usable <strong>{prepared.length - valid.length + fileErrors.length}</strong>
                </span>
              )}
            </div>
            {fileErrors.length > 0 && (
              <details className={styles.details}>
                <summary>{fileErrors.length} file(s) could not be read</summary>
                <ul className={styles.formatList}>
                  {fileErrors.slice(0, 50).map((f, i) => (
                    <li key={i}>
                      {f.path}: {f.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <button type="button" className={styles.linkButton} disabled={busy} onClick={clearAll} style={{ marginTop: 8 }}>
              Clear all
            </button>
          </Section>
        )}
      </aside>

      <div className={styles.stack}>
        {current && (
          <section className={styles.card} aria-label="Selected drawing">
            <div className={styles.sectionTitle}>
              <span>{current.name}</span>
              <span className={styles.headerActions}>
                <button type="button" className={styles.button} onClick={() => setSelected(null)}>
                  Close
                </button>
              </span>
            </div>
            <p className={styles.hint} style={{ marginTop: -6 }}>
              {current.path} · {current.points.length} points · {fmt(current.points[current.points.length - 1]?.t / 1000)} s ·{" "}
              {current.cssPpi ? `${current.cssPpi} CSS px/inch (from file)` : `${defaultPpi} CSS px/inch (assumed)`} · group “{current.group}”
            </p>
            {current.error ? (
              <div className={styles.error}>{current.error}</div>
            ) : (
              <SpiralPlayer
                key={current.id}
                fit="data"
                showSpeed
                spiral={{ points: current.points, cssPpi: current.cssPpiUsed, options: { canvasCm: 10 }, truth: { fitsCanvas: true, reachCm: 0 } }}
              />
            )}
            {current.notes.length > 0 && (
              <ul className={styles.noteList}>
                {current.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {rowsByRef.get(current.ref)?.result && (
              <div className={styles.metricsGrid}>
                {KEY_METRICS.map((k) => (
                  <div key={k}>
                    <span>{k}</span>
                    <span>{fmt(rowsByRef.get(current.ref).result[k], 3)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className={styles.card} aria-label="Uploaded drawings">
          <div className={styles.sectionTitle}>
            <span>
              {prepared.length} drawing{prepared.length === 1 ? "" : "s"}
              {prepared.length > PAGE_SIZE && ` · page ${page + 1} of ${pages}`}
            </span>
            {prepared.length > 0 && (
              <span className={styles.headerActions}>
                <span className={styles.segmented} role="group" aria-label="Show">
                  <button type="button" aria-pressed={filter === "all"} onClick={() => (setFilter("all"), setPage(0))}>
                    All
                  </button>
                  <button type="button" aria-pressed={filter === "problems"} onClick={() => (setFilter("problems"), setPage(0))}>
                    Problems and notes
                  </button>
                </span>
              </span>
            )}
          </div>

          {prepared.length === 0 ? (
            <p className={styles.status}>No drawings yet. Drop JSON files or a folder on the left.</p>
          ) : (
            <>
              <div className={styles.gallery}>
                {pageItems.map((d) => {
                  const r = rowsByRef.get(d.ref);
                  const state = d.error ? "dotFailed" : r ? { done: "dotDone", failed: "dotFailed", running: "dotRunning" }[r.status] ?? "dotQueued" : d.notes.length ? "dotNote" : null;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={styles.galleryItem}
                      aria-pressed={selected === d.id}
                      title={[d.path, d.error, ...d.notes, r?.error].filter(Boolean).join("\n")}
                      onClick={() => setSelected(d.id)}
                    >
                      <PointsThumb points={d.points} color={d.error ? "#a32d2d" : "#4b5be0"} />
                      <span className={styles.galleryName}>
                        {state && <span className={`${styles.dot} ${styles[state]}`} />}
                        {d.name}
                      </span>
                      <span className={styles.hint}>
                        {r?.result?.DOS != null ? `DOS ${fmt(r.result.DOS)}` : d.error ? "not usable" : `${d.points.length} pts`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {pages > 1 && (
                <div className={styles.actions} style={{ justifyContent: "center" }}>
                  <button type="button" className={styles.button} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    ← Previous
                  </button>
                  <span className={styles.status}>
                    Page {page + 1} of {pages}
                  </span>
                  <button type="button" className={styles.button} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}

          {valid.length > 0 && (
            <div className={styles.sendBox}>
              <div className={styles.field} style={{ marginBottom: 8 }}>
                <label className={styles.label} htmlFor="upload-name">
                  Batch name (optional)
                </label>
                <input id="upload-name" className={styles.nameInput} value={name} placeholder="e.g. clinic export, March" onChange={(e) => setName(e.target.value)} />
              </div>
              <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={analyze}>
                {sending ? `Sending part ${sending.part} of ${sending.parts}…` : `Analyze ${valid.length} drawing${valid.length === 1 ? "" : "s"}`}
              </button>
              <p className={styles.footnote}>
                Sent to the batch API in parts of up to 100 and analyzed on the server, about 20 at a time (30–60 s each in MATLAB).
                Uploaded drawings are kept only with this batch; they are not added to the site&apos;s drawings.
              </p>
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
        </section>

        {active && <RunProgress jobs={jobs} items={runItems} active={active} source="api" />}

        <BatchResults
          summary={summary}
          title="Results by group"
          groupLabel="Group"
          actions={
            <button type="button" className={styles.button} disabled={!rows.length} onClick={() => download("spiral-uploads.csv", uploadsCsv(prepared, rowsByRef), "text/csv")}>
              Download CSV
            </button>
          }
        />
      </div>
    </div>
  );
}
