// Server-side helpers for talking to a spiral analysis backend (the MATLAB
// service on Cloud Run today, a Python port later). Both take the payload
// produced by prepareDrawData() and return a flat object of metrics.
import { computeWidthMetrics } from "@/lib/widthMetrics";

export const MATLAB_BACKEND_URL = "https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral";

const WIDTH_KEYS = [
  "overall average of widths",
  "std of widths.",
  "COV of width",
  "1st quad average median",
  "2nd quad average median",
  "3rd quad average median",
  "4th quad average median",
];

// Compute width metrics in JS and fill any blank values from the backend.
// MATLAB leaves width fields as "No Axis" when the interp1 bug fires.
// Mutates and returns `result`. Never throws: a failure here only means the
// blanks stay blank.
export function fillMissingWidthMetrics(result, drawData) {
  try {
    const wm = computeWidthMetrics(drawData);
    if (wm) {
      WIDTH_KEYS.forEach((k) => {
        const existing = result[k];
        const isBlank =
          existing == null ||
          existing === "" ||
          (typeof existing === "string" && /^no axis$/i.test(existing.trim()));
        if (isBlank && wm[k] != null) result[k] = String(wm[k]);
      });
    }
  } catch (wmErr) {
    console.error("JS width metrics failed (non-fatal):", wmErr.message);
  }
  return result;
}

export class BackendError extends Error {
  constructor(message, { retryable = false, status = null, timedOut = false } = {}) {
    super(message);
    this.name = "BackendError";
    this.retryable = retryable;
    this.status = status;
    this.timedOut = timedOut;
  }
}

// MATLAB reads each point's fields by position, not by name: the same points
// with keys in another order come back as "error". Points that went through
// Postgres jsonb (stored drawings, stored payloads) have their keys reordered
// (n, p, t, x, y), so every payload is rebuilt in the order MATLAB expects.
export function toBackendPoints(drawData) {
  return drawData.map(({ n, x, y, p, t }) => ({ n, x, y, p, t }));
}

// One analysis call. Throws BackendError; `retryable` says whether trying the
// same input again could plausibly succeed (timeouts, 5xx, 429).
export async function runSpiralBackend({
  url,
  drawData,
  timeoutMs,
  fillWidthMetrics = false,
  fetchImpl = fetch,
}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(toBackendPoints(drawData)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new BackendError(
      timedOut ? `Backend did not answer within ${Math.round(timeoutMs / 1000)}s` : `Backend unreachable: ${err?.message}`,
      { retryable: true, timedOut }
    );
  }

  const text = await response.text();
  if (!response.ok) {
    throw new BackendError(`Backend returned ${response.status}: ${text.slice(0, 500)}`, {
      status: response.status,
      retryable: response.status >= 500 || response.status === 429,
    });
  }
  if (!text.trim()) throw new BackendError("Backend returned an empty response", { retryable: true });

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new BackendError("Backend returned invalid JSON", { retryable: true });
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new BackendError("Backend returned something other than an object of metrics");
  }
  // The drawing page records these as failed analyses rather than results.
  if (result.status === "timeout" || result.status === "error") {
    throw new BackendError(`Backend reported status "${result.status}"`, { retryable: true });
  }

  return fillWidthMetrics ? fillMissingWidthMetrics(result, drawData) : result;
}
