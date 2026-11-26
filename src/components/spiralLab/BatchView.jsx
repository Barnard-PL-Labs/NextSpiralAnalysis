"use client";
// Batch view. Spirals are added here or from the Simple / Detailed views
// ("Add to batch"), then sent to the batch API (/api/batch) as recipes: the
// server draws and analyzes each one in the background, so a big batch keeps
// going after this tab closes. Results come back into the same per-type
// comparison. Running from this tab instead is kept as a fallback for when
// the API is not set up.
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/styles/SpiralLab.module.css";
import { Section, Slider } from "@/components/spiralLab/Controls";
import SpiralThumb from "@/components/spiralLab/SpiralThumb";
import RunProgress from "@/components/spiralLab/RunProgress";
import BatchResults from "@/components/spiralLab/BatchResults";
import { supabase } from "@/lib/supabaseClient";
import { generateSpiral } from "@/lib/syntheticSpiral";
import { prepareDrawData } from "@/lib/spiralPreprocess";
import { PRESET_GROUPS, START_PRESETS, describeSpiral, fitLimits, presetSettings, settingsToOptions } from "@/lib/spiralLab";
import {
  BATCH_CONCURRENCY,
  COPY_JITTER_CM,
  MAX_BATCH,
  MAX_COPIES,
  batchToCsv,
  batchToJson,
  estimateMinutes,
  expandBatch,
  jobsFromServerRows,
  summarizeBatch,
  toApiSpirals,
} from "@/lib/spiralBatch";

const CURRENT = "__current__";
// Sent batches: how many to show at first, and how many more per click.
const SENT_FIRST = 5;
const SENT_MORE = 10;
const ANALYZE_TIMEOUT_MS = 150_000;
const POLL_MS = 5000;

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function minutes(m) {
  return m < 1 ? "under a minute" : `about ${Math.round(m)} min`;
}

async function accessToken() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// Turn an API failure into something a researcher can act on.
function explainApiError(status, body) {
  if (status === 401) return "Sign in on the main site with a researcher (superuser) account, then come back to send batches.";
  if (status === 403) return "This account is not a researcher (superuser) account, so it cannot send batches.";
  if (status === 500 && /Supabase credentials/i.test(body?.error || "")) {
    return "The batch API is not set up on this server yet: it needs the database tables (supabase db push) and the service role key. Until then, use “Run in this tab instead”.";
  }
  if (status === 500 && /create the batch/i.test(body?.error || "")) {
    return "The server could not create the batch. Most likely the batch tables have not been created yet (supabase db push).";
  }
  return body?.error || `The batch API answered ${status}.`;
}

async function analyzeHere(drawData, signal) {
  const timeout = AbortSignal.timeout(ANALYZE_TIMEOUT_MS);
  const combined = typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal;
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drawData }),
    signal: combined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.result) {
    const err = new Error(body.error || body.message || `Analysis failed (HTTP ${res.status})`);
    err.retryable = res.status >= 500;
    throw err;
  }
  return body.result;
}

export default function BatchView({ batch, currentSettings, onOpen }) {
  const { items, total, varyCopies, setVaryCopies } = batch;
  const [choice, setChoice] = useState("baseline");
  const [copies, setCopies] = useState(5);
  const [name, setName] = useState("");

  // The run being shown: jobs with status/result, from the API or from this tab.
  const [jobs, setJobs] = useState([]);
  const [runItems, setRunItems] = useState([]);
  const [source, setSource] = useState(null); // "api" | "local"
  const [busy, setBusy] = useState(false); // sending, or running locally
  const [apiError, setApiError] = useState(null);
  const [active, setActive] = useState(null); // { batchId, label, status }
  const [sent, setSent] = useState([]); // spiral-lab batches on the server, newest first
  const [sentNext, setSentNext] = useState(null); // offset of the next page, or null
  const abortRef = useRef(null);
  const pollRef = useRef(null);

  const room = MAX_BATCH - total;
  const chosenSettings = choice === CURRENT ? currentSettings : presetSettings(choice);
  const chosenFits = fitLimits(chosenSettings).fits;

  const addChosen = () => batch.add(chosenSettings, copies);
  const addStartSet = () => START_PRESETS.forEach((p) => batch.add(presetSettings(p.id), copies, p.label));

  // ---------------------------------------------------------------- API path

  // Batches live on the server, so this list is the same on any computer.
  // The newest few are shown; "Show more" pages back through the rest.
  const loadSent = useCallback(async (offset, limit) => {
    const token = await accessToken();
    if (!token) return null;
    try {
      const res = await fetch(`/api/batch?kind=synthetic,inline&limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      return res.ok ? body : null;
    } catch {
      return null; // The list is a convenience; sending still reports its own errors.
    }
  }, []);
  const refreshSent = useCallback(async () => {
    const page = await loadSent(0, SENT_FIRST);
    if (!page) return;
    setSent(page.batches || []);
    setSentNext(page.nextOffset);
  }, [loadSent]);
  const showMoreSent = async () => {
    if (sentNext == null) return;
    const page = await loadSent(sentNext, SENT_MORE);
    if (!page) return;
    setSent((prev) => [...prev, ...(page.batches || []).filter((b) => !prev.some((p) => p.id === b.id))]);
    setSentNext(page.nextOffset);
  };
  useEffect(() => {
    refreshSent();
  }, [refreshSent]);

  const stopPolling = () => {
    clearTimeout(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => () => {
    stopPolling();
    abortRef.current?.abort();
  }, []);

  // Fetch progress and every result so far, rebuild the view from the
  // server's rows (types, copies and settings all come back with them), and
  // keep checking until the batch is finished.
  const poll = useCallback(async (record) => {
    const token = await accessToken();
    if (!token) {
      setApiError(explainApiError(401));
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const statusRes = await fetch(`/api/batch/${record.batchId}`, { headers });
      const status = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) throw new Error(explainApiError(statusRes.status, status));

      const rows = [];
      for (let offset = 0; offset != null; ) {
        const res = await fetch(`/api/batch/${record.batchId}/results?offset=${offset}&limit=1000`, { headers });
        const page = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(explainApiError(res.status, page));
        rows.push(...page.items);
        offset = page.nextOffset;
      }
      const rebuilt = jobsFromServerRows(rows);
      setRunItems(rebuilt.items);
      setJobs(rebuilt.jobs);
      setActive({
        batchId: record.batchId,
        label: status.label ?? record.label,
        status: status.status,
        createdAt: status.createdAt,
        finishedAt: status.finishedAt,
      });
      setApiError(null);
      if (status.status !== "completed") pollRef.current = setTimeout(() => poll(record), POLL_MS);
      else refreshSent();
    } catch (err) {
      setApiError(err.message);
      pollRef.current = setTimeout(() => poll(record), POLL_MS * 3);
    }
  }, [refreshSent]);

  const showSent = (record) => {
    stopPolling();
    abortRef.current?.abort();
    setSource("api");
    setRunItems([]);
    setJobs([]);
    setActive({ batchId: record.batchId, label: record.label, status: record.status });
    poll(record);
  };

  const sendToApi = async () => {
    const synthetic = toApiSpirals(items, { varyCopies });
    if (!synthetic.length) return;
    if (source === "api" && active && active.status !== "completed") {
      const again = window.confirm(`“${active.label}” is still running. Send another batch anyway?`);
      if (!again) return;
    }
    setApiError(null);
    const token = await accessToken();
    if (!token) {
      setApiError(explainApiError(401));
      return;
    }
    setBusy(true);
    try {
      const label = name.trim() || `Spiral lab · ${new Date().toLocaleString()}`;
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label, backends: ["matlab"], synthetic }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(explainApiError(res.status, body));
      showSent({ batchId: body.batchId, label, status: "running" });
      refreshSent();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------ local path

  const runHere = async () => {
    const list = expandBatch(items, { varyCopies });
    if (!list.length) return;
    stopPolling();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSource("local");
    setActive({ label: "this tab", status: "running", createdAt: new Date().toISOString() });
    setApiError(null);
    setRunItems(items);
    setJobs(list.map((j) => ({ ...j, status: "queued" })));
    setBusy(true);

    const update = (key, patch) => setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));
    let next = 0;
    const lane = async () => {
      while (next < list.length && !ctrl.signal.aborted) {
        const job = list[next];
        next += 1;
        const started = Date.now();
        update(job.key, { status: "running", since: new Date().toISOString() });
        let truth = null;
        try {
          const spiral = generateSpiral(settingsToOptions(job.settings));
          truth = spiral.truth;
          const drawData = prepareDrawData(spiral.points, spiral.cssPpi);
          let result;
          try {
            result = await analyzeHere(drawData, ctrl.signal);
          } catch (err) {
            if (ctrl.signal.aborted || err.retryable === false) throw err;
            result = await analyzeHere(drawData, ctrl.signal);
          }
          update(job.key, { status: "done", result, truth, seconds: (Date.now() - started) / 1000 });
        } catch (err) {
          if (ctrl.signal.aborted) update(job.key, { status: "stopped" });
          else {
            const message = err?.name === "TimeoutError" ? `No answer after ${ANALYZE_TIMEOUT_MS / 1000} s` : err?.message || "Failed";
            update(job.key, { status: "failed", error: message, truth, seconds: (Date.now() - started) / 1000 });
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, list.length) }, lane));
    setJobs((prev) => prev.map((j) => (j.status === "queued" ? { ...j, status: "stopped" } : j)));
    setActive((prev) => prev && { ...prev, status: "completed", finishedAt: new Date().toISOString() });
    setBusy(false);
  };

  const stopHere = () => abortRef.current?.abort();

  // ---------------------------------------------------------------- render

  const localRunning = busy && source === "local";
  const finished = jobs.filter((j) => j.status === "done" || j.status === "failed").length;
  const summary = jobs.length ? summarizeBatch(runItems, jobs) : [];
  const editable = !busy;

  return (
    <div className={styles.layout}>
      {/* ---------------- Add spirals ---------------- */}
      <aside className={styles.card} aria-label="Add spirals to the batch">
        <Section title="Add spirals">
          <p className={styles.hint} style={{ marginTop: 0 }}>
            You can also add the spiral you are working on from the Simple or Detailed view with “Add to batch”.
          </p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="batch-type">
              Type
            </label>
            <select id="batch-type" className={styles.select} value={choice} onChange={(e) => setChoice(e.target.value)}>
              {PRESET_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Yours">
                <option value={CURRENT}>The spiral set up in Simple / Detailed</option>
              </optgroup>
            </select>
          </div>
          <div className={styles.preview}>
            <SpiralThumb settings={chosenSettings} size={64} />
            <div>
              <div className={styles.previewText}>{describeSpiral(chosenSettings)}</div>
              {!chosenFits && <div className={styles.limitOver}>Goes past the edge of the 10 cm canvas.</div>}
            </div>
          </div>
          <Slider label="How many" value={copies} onChange={(n) => setCopies(Math.max(1, Math.min(MAX_COPIES, Math.round(n))))} min={1} max={20} step={1} digits={0} />
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!editable || room < 1} onClick={addChosen}>
              Add {Math.min(copies, Math.max(room, 0))} to batch
            </button>
            <button type="button" className={styles.button} disabled={!editable || room < 1} onClick={addStartSet}>
              Add {copies} of each Start here type
            </button>
          </div>
          {room < 1 && <div className={styles.limitOver}>The batch is full ({MAX_BATCH} spirals).</div>}
        </Section>

        <Section title="Copies">
          <label className={styles.toggle}>
            <input type="checkbox" checked={varyCopies} disabled={!editable} onChange={(e) => setVaryCopies(e.target.checked)} />
            Make copies differ slightly
          </label>
          <div className={styles.hint}>
            Each copy gets its own random seed. Spirals with no hand jitter would come out identical, so this adds{" "}
            {COPY_JITTER_CM * 10} mm of jitter to those. The spread across copies then shows how stable each result is.
          </div>
        </Section>

        {sent.length > 0 && (
          <Section title="Sent batches">
            {sent.map((r) => (
              <div key={r.id} className={styles.sentRow}>
                <div>
                  <div className={styles.label}>{r.label || "Untitled batch"}</div>
                  <div className={styles.hint}>
                    {r.total_items} {r.options?.kind === "inline" ? "uploaded drawings" : "spirals"} · {new Date(r.created_at).toLocaleString()} · {r.status === "completed" ? "finished" : "running"}
                    {r.created_by && ` · ${r.created_by === "api-key" ? "script" : r.created_by}`}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.button}
                  disabled={busy}
                  aria-pressed={active?.batchId === r.id}
                  onClick={() => showSent({ batchId: r.id, label: r.label, status: r.status })}
                >
                  Show results
                </button>
              </div>
            ))}
            <div className={styles.actions} style={{ marginTop: 6 }}>
              {sentNext != null && (
                <button type="button" className={styles.linkButton} onClick={showMoreSent}>
                  Show more
                </button>
              )}
              {sent.length > SENT_FIRST && (
                <button type="button" className={styles.linkButton} onClick={refreshSent}>
                  Show fewer
                </button>
              )}
            </div>
          </Section>
        )}
      </aside>

      {/* ---------------- The batch and its results ---------------- */}
      <div className={styles.stack}>
        <section className={styles.card} aria-label="Batch">
          <div className={styles.sectionTitle}>
            <span>
              Batch · {total} spiral{total === 1 ? "" : "s"}
            </span>
            <button type="button" className={styles.button} disabled={!editable || !total} onClick={batch.clear}>
              Clear
            </button>
          </div>

          {items.length === 0 ? (
            <p className={styles.status}>
              Nothing here yet. Set up a spiral in Simple or Detailed and press “Add to batch”, or pick a type on the left.
            </p>
          ) : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Copies</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.batchType}>
                          <SpiralThumb settings={item.settings} />
                          <div style={{ flex: 1 }}>
                            <input
                              className={styles.nameInput}
                              value={item.label}
                              disabled={!editable}
                              aria-label="Name of this type"
                              onChange={(e) => batch.update(item.id, { label: e.target.value })}
                            />
                            <div className={styles.hint}>
                              {describeSpiral(item.settings)}{" "}
                              <button type="button" className={styles.linkButton} onClick={() => onOpen(item.settings)}>
                                Open
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <input
                          className={styles.number}
                          type="number"
                          min={1}
                          max={MAX_COPIES}
                          value={item.copies}
                          disabled={!editable}
                          aria-label={`Copies of ${item.label}`}
                          onChange={(e) => batch.update(item.id, { copies: Math.max(1, Math.min(MAX_COPIES, Math.round(Number(e.target.value)) || 1)) })}
                        />
                      </td>
                      <td>
                        <button type="button" className={styles.button} disabled={!editable} onClick={() => batch.remove(item.id)} aria-label={`Remove ${item.label}`}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className={styles.sendBox}>
              <div className={styles.field} style={{ marginBottom: 8 }}>
                <label className={styles.label} htmlFor="batch-name">
                  Batch name (optional)
                </label>
                <input
                  id="batch-name"
                  className={styles.nameInput}
                  value={name}
                  placeholder="e.g. tremor sizes, first try"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className={styles.actions} style={{ marginTop: 0 }}>
                <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={sendToApi}>
                  {busy && source !== "local" ? "Sending…" : `Send ${total} spiral${total === 1 ? "" : "s"} to the batch API`}
                </button>
                {localRunning ? (
                  <button type="button" className={styles.button} onClick={stopHere}>
                    Stop
                  </button>
                ) : (
                  <button type="button" className={styles.linkButton} disabled={busy} onClick={runHere}>
                    Run in this tab instead
                  </button>
                )}
              </div>
              <p className={styles.footnote}>
                The batch API draws and analyzes every spiral on the server, about 20 at a time, and keeps going if you close this tab;
                find it again under “Sent batches”, from any computer. Needs a researcher sign-in. “Run in this tab” needs no setup but only runs{" "}
                {BATCH_CONCURRENCY} at a time ({minutes(estimateMinutes(total))}) and stops if the tab closes.
              </p>
            </div>
          )}
          {apiError && <div className={styles.error}>{apiError}</div>}

        </section>

        <RunProgress jobs={jobs} items={runItems} active={active} source={source} />

        <BatchResults
          summary={summary}
          actions={
            <>
              <button type="button" className={styles.button} disabled={!finished} onClick={() => download("spiral-batch.csv", batchToCsv(jobs), "text/csv")}>
                Download CSV
              </button>
              <button type="button" className={styles.button} disabled={busy} onClick={() => download("spiral-batch.json", batchToJson(jobs), "application/json")}>
                Download spirals (JSON)
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
