"use client";
// Spiral lab: specify a spiral, watch it being drawn, and see whether the
// analysis measures back what was put in. Two views: Simple (loops, spacing,
// time, tremor) and Detailed (every generator setting). Unlisted research
// tool; see src/lib/syntheticSpiral.js.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authProvider";
import { useSuperuser } from "@/lib/useSuperuser";
import styles from "@/styles/SpiralLab.module.css";
import AnalysisCard, { fmt } from "@/components/spiralLab/AnalysisCard";
import AddToBatch from "@/components/spiralLab/AddToBatch";
import BatchView from "@/components/spiralLab/BatchView";
import UploadView from "@/components/spiralLab/UploadView";
import { useBatchList } from "@/components/spiralLab/useBatchList";
import DetailedControls from "@/components/spiralLab/DetailedControls";
import RunsCard, { runsToCsv } from "@/components/spiralLab/RunsCard";
import SimpleControls from "@/components/spiralLab/SimpleControls";
import SpiralPlayer from "@/components/spiralLab/SpiralPlayer";
import { generateSpiral } from "@/lib/syntheticSpiral";
import { prepareDrawData } from "@/lib/spiralPreprocess";
import { computeWidthMetrics } from "@/lib/widthMetrics";
import { DEFAULT_SETTINGS, buildHash, describeSpiral, parseHash, pointsToCsv, settingsToOptions } from "@/lib/spiralLab";

const ANALYZE_TIMEOUT_MS = 150_000;

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SpiralLabPage() {
  const [view, setView] = useState("simple");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [analysis, setAnalysis] = useState(null);
  const [runs, setRuns] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const batch = useBatchList();
  const { user } = useAuth();
  const { isSuperuser, loading: checkingAccess } = useSuperuser(user);
  const linkRead = useRef(false);

  // View and settings live in the URL fragment, so a link reproduces both.
  useEffect(() => {
    const fromLink = parseHash(window.location.hash);
    if (fromLink.view) setView(fromLink.view);
    if (fromLink.settings) setSettings(fromLink.settings);
    linkRead.current = true;
  }, []);
  useEffect(() => {
    if (!linkRead.current) return;
    const hash = buildHash({ view, settings });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }, [view, settings]);

  const simple = view === "simple";
  const openDetailed = () => {
    setView("detailed");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { spiral, error } = useMemo(() => {
    try {
      return { spiral: generateSpiral(settingsToOptions(settings)), error: null };
    } catch (err) {
      return { spiral: null, error: err.message };
    }
  }, [settings]);

  const settingsKey = JSON.stringify(settings);

  useEffect(() => {
    if (analysis?.status !== "running") return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [analysis?.status]);

  const analyze = async () => {
    if (!spiral) return;
    const startedAt = Date.now();
    setNow(startedAt);
    setAnalysis({ status: "running", startedAt });
    try {
      const drawData = prepareDrawData(spiral.points, spiral.cssPpi);
      const jsWidths = computeWidthMetrics(drawData);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawData }),
        signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.result) throw new Error(body.error || body.message || `Analysis failed (HTTP ${res.status})`);
      const done = {
        status: "done",
        id: startedAt,
        seconds: (Date.now() - startedAt) / 1000,
        result: body.result,
        jsWidths,
        truth: spiral.truth,
        settings,
        settingsKey,
      };
      setAnalysis(done);
      setRuns((prev) => [done, ...prev].slice(0, 30));
    } catch (err) {
      const timedOut = err?.name === "TimeoutError";
      setAnalysis({
        status: "error",
        error: timedOut ? `No answer after ${ANALYZE_TIMEOUT_MS / 1000}s. The backend may be starting up; try again.` : err.message,
      });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  };

  const downloadJson = () =>
    download(
      `spiral-${settings.seed}.json`,
      JSON.stringify({ settings: settingsToOptions(settings), truth: spiral.truth, cssPpi: spiral.cssPpi, points: spiral.points }, null, 1),
      "application/json"
    );

  const truth = spiral?.truth;
  const stale = analysis?.status === "done" && analysis.settingsKey !== settingsKey;

  // Researchers only. This only hides the page; the batch API checks the
  // superuser itself on every request.
  if (checkingAccess || !user || !isSuperuser) {
    return (
      <main className={styles.page}>
        <div className={styles.gate}>
          <h1 className={styles.title}>Spiral lab</h1>
          {checkingAccess ? (
            <p className={styles.lead}>Checking access…</p>
          ) : (
            <>
              <p className={styles.lead}>
                {user
                  ? "This research tool is only open to researcher (superuser) accounts."
                  : "This research tool is only open to researchers. Sign in with a researcher account to use it."}
              </p>
              <Link href="/" className={`${styles.button} ${styles.primary}`}>
                Go to the home page
              </Link>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Spiral lab</h1>
            <p className={styles.lead}>
              {view === "upload"
                ? "Load drawings from JSON files, look at them, and run them all through the analysis."
                : view === "batch"
                ? "Build a batch: pick spiral types, choose how many of each, and run them all through the analysis to compare the types."
                : simple
                  ? "Set a few numbers, watch the machine draw the spiral, then check whether the analysis measures back what you set."
                  : "Every setting the spiral machine has. Change one thing at a time and compare runs to see what each metric responds to."}
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={`${styles.segmented} ${styles.viewSwitch}`} role="group" aria-label="View">
              <button type="button" aria-pressed={simple} onClick={() => setView("simple")}>
                Simple
              </button>
              <button type="button" aria-pressed={view === "detailed"} onClick={() => setView("detailed")}>
                Detailed
              </button>
              <button type="button" aria-pressed={view === "batch"} onClick={() => setView("batch")}>
                Batch{batch.total > 0 ? ` (${batch.total})` : ""}
              </button>
              <button type="button" aria-pressed={view === "upload"} onClick={() => setView("upload")}>
                Upload
              </button>
            </div>
            <button type="button" className={styles.button} onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
      </header>

      {view === "upload" ? (
        <UploadView />
      ) : view === "batch" ? (
        <BatchView
          batch={batch}
          currentSettings={settings}
          onOpen={(s) => {
            setSettings(s);
            setView("simple");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : (
      <div className={styles.layout}>
        {simple ? (
          <SimpleControls settings={settings} setSettings={setSettings} onOpenDetailed={openDetailed} />
        ) : (
          <DetailedControls settings={settings} setSettings={setSettings} />
        )}

        <div className={styles.stack}>
          <section className={styles.card} aria-label="Spiral">
            {!error && <p className={styles.summary}>{describeSpiral(settings)}</p>}
            {truth && !truth.fitsCanvas && (
              <p className={styles.warning}>
                This spiral reaches {fmt(truth.reachCm, 1)} cm from the centre, past the 5 cm edge of the 10 cm test canvas
                (shaded red). A real drawing on the test page could not go there, but you can still watch and analyze it. The red
                marks on the sliders show the largest values that fit.
              </p>
            )}
            <SpiralPlayer spiral={spiral} showSpeed={!simple} />
            {error && <div className={styles.error}>{error}</div>}

            {!simple && truth && (
              <div className={styles.facts}>
                <div className={styles.fact}>
                  <div className={styles.factLabel}>Points</div>
                  <div className={styles.factValue}>{spiral.points.length}</div>
                </div>
                <div className={styles.fact}>
                  <div className={styles.factLabel}>Mean spacing</div>
                  <div className={styles.factValue}>{fmt(truth.loopSpacingCm, 3)} cm</div>
                </div>
                <div className={styles.fact}>
                  <div className={styles.factLabel}>Mean pen speed</div>
                  <div className={styles.factValue}>{fmt(truth.meanSpeedCmPerS)} cm/s</div>
                </div>
                <div className={styles.fact}>
                  <div className={styles.factLabel}>Duration</div>
                  <div className={styles.factValue}>{fmt(spiral.points[spiral.points.length - 1].t / 1000)} s</div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.button} disabled={!spiral || analysis?.status === "running"} onClick={analyze}>
                {analysis?.status === "running" ? "Analyzing…" : "Analyze just this one"}
              </button>
              {!simple && (
                <>
                  <button type="button" className={styles.button} disabled={!spiral} onClick={downloadJson}>
                    Download JSON
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={!spiral}
                    onClick={() => download(`spiral-${settings.seed}.csv`, pointsToCsv(spiral.points), "text/csv")}
                  >
                    Download CSV
                  </button>
                </>
              )}
            </div>
            <AddToBatch
              settings={settings}
              batch={batch}
              disabled={!spiral}
              onOpenBatch={() => {
                setView("batch");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </section>

          <AnalysisCard analysis={analysis} now={now} stale={stale} simple={simple} onOpenDetailed={openDetailed} />

          {!simple && (
            <RunsCard runs={runs} onLoad={setSettings} onDownload={() => download("spiral-lab-runs.csv", runsToCsv(runs), "text/csv")} />
          )}
        </div>
      </div>
      )}
    </main>
  );
}
