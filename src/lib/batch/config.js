// Server-only settings for the batch analysis API (src/app/api/batch).
import { MATLAB_BACKEND_URL } from "@/lib/spiralBackend";

export const MAX_DRAWINGS_PER_BATCH = 5000;
// Inline drawings travel in the request body, which Vercel caps at 4.5 MB.
export const MAX_INLINE_DRAWINGS = 100;
export const DEFAULT_WORKERS = 20;
export const MAX_WORKERS = 50;

// A row is tried at most this many times (timeouts, 5xx) before it is marked failed.
export const MAX_ATTEMPTS = 3;
// How long a claimed row belongs to one worker. Longer than a worker can live
// (WORKER_MAX_DURATION_S), so a live worker never loses its row, and a dead
// worker's row comes back after at most this long.
export const LEASE_SECONDS = 330;

// Must match `maxDuration` in src/app/api/batch/[id]/work/route.js.
// Measured 2026-11-25 with synthetic spirals: one MATLAB call takes ~30 s warm
// and ~60 s cold, so a worker needs minutes, not the 60 s minimum. 300 s is
// the Vercel default with Fluid compute; /api/analyze already relies on more
// than 60 s in production.
export const WORKER_MAX_DURATION_S = 300;
// A worker stops claiming new rows after this long and hands over to a fresh
// invocation, leaving headroom before the platform kills it.
export const WORK_BUDGET_MS = 280_000;
export const BACKEND_TIMEOUT_MS = 120_000;
// Only start a call that can run for its full timeout, so a slow backend is
// never cut short by the worker's own clock.
export const MIN_START_MS = BACKEND_TIMEOUT_MS + 10_000;

// Drawings saved before drawings.css_ppi existed (2026-08-19) were all scaled
// as an iPad: 264 PPI at devicePixelRatio 2. Rows that fall back to this are
// flagged css_ppi_assumed in the results.
export const DEFAULT_CSS_PPI = 132;

// Backends a batch can target. Each one takes the prepareDrawData() payload as
// a JSON array and answers with a flat JSON object of metrics.
//
// `version` is part of the result cache key: bump the env var whenever the
// backend's code changes, or results from the old code will be reused.
// `fillWidthMetrics` applies the same "No Axis" patch /api/analyze applies to
// MATLAB, so batch results match what users see. It is off for new backends
// so a comparison shows their real output.
export function getBackends(env = process.env) {
  const backends = {
    matlab: {
      url: env.MATLAB_BACKEND_URL || MATLAB_BACKEND_URL,
      version: env.MATLAB_BACKEND_VERSION || "1",
      fillWidthMetrics: true,
    },
  };
  if (env.PYTHON_BACKEND_URL) {
    backends.python = {
      url: env.PYTHON_BACKEND_URL,
      version: env.PYTHON_BACKEND_VERSION || "1",
      fillWidthMetrics: false,
    };
  }
  return backends;
}
