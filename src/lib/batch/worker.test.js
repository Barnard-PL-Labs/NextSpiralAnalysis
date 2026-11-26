// @vitest-environment node
import { BackendError } from "@/lib/spiralBackend";
import { BACKEND_TIMEOUT_MS, MAX_ATTEMPTS } from "./config";
import { processItem, runWorker, summarizeProgress } from "./worker";

const BACKENDS = { matlab: { url: "http://backend.test/run", version: "1", fillWidthMetrics: false } };

const spiral = (n = 60, pressure = (i) => 300 + (i % 40) * 10) =>
  Array.from({ length: n }, (_, i) => ({
    x: 100 + i * Math.cos(i / 4),
    y: 100 + i * Math.sin(i / 4),
    p: pressure(i),
    t: i * 8,
  }));

// In-memory stand-in for createBatchStore(), including the claim semantics
// of claim_analysis_batch_items().
function fakeStore({ drawings = {}, items = [], batch = {} } = {}) {
  const state = {
    batch: { id: "b1", status: "running", use_cache: true, options: {}, ...batch },
    items: items.map((it, i) => ({
      id: i + 1,
      backend: "matlab",
      backend_version: "1",
      status: "queued",
      attempts: 0,
      input_hash: null,
      ...it,
    })),
  };
  const store = {
    state,
    getBatch: async () => state.batch,
    claim: async (_id, { limit }) => {
      const free = state.items.filter((it) => it.status === "queued").slice(0, limit);
      free.forEach((it) => {
        it.status = "running";
        it.attempts += 1;
      });
      return free.map((it) => ({ ...it }));
    },
    loadDrawing: async (id) => drawings[id] ?? null,
    // Same rule as the real store: an earlier finished row that called the backend.
    getCached: async (h, b, v) =>
      state.items.find((it) => it.input_hash === h && it.backend === b && it.backend_version === v && it.status === "done" && !it.cache_hit && it.result)
        ?.result ?? null,
    updateItem: async (id, patch) => Object.assign(state.items.find((it) => it.id === id), patch),
  };
  return store;
}

const farDeadline = () => Date.now() + 10 * 60_000;

describe("processItem", () => {
  it("prepares a stored drawing, calls the backend, and records the input's hash", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(), css_ppi: 132 } },
      items: [{ drawing_id: "d1" }],
    });
    const runBackend = vi.fn(async () => ({ DOS: "1.5" }));
    const [item] = await store.claim("b1", { limit: 1 });

    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend });

    const row = store.state.items[0];
    expect(row).toMatchObject({ status: "done", result: { DOS: "1.5" }, cache_hit: false, css_ppi: 132, css_ppi_assumed: false });
    expect(row.input_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(runBackend.mock.calls[0][0].drawData.length).toBeGreaterThan(50);
  });

  it("reuses a cached answer for identical input instead of calling the backend", async () => {
    const drawing = { drawing_data: spiral(), css_ppi: 132 };
    const store = fakeStore({
      drawings: { d1: { id: "d1", ...drawing }, d2: { id: "d2", ...drawing } },
      items: [{ drawing_id: "d1" }, { drawing_id: "d2" }],
    });
    const runBackend = vi.fn(async () => ({ DOS: "2" }));

    await runWorker({ store, batchId: "b1", backends: BACKENDS, deadline: farDeadline(), runBackend });

    expect(runBackend).toHaveBeenCalledTimes(1);
    expect(store.state.items.map((it) => [it.status, it.cache_hit])).toEqual([
      ["done", false],
      ["done", true],
    ]);
  });

  it("calls the backend again when the batch turns reuse off", async () => {
    const drawing = { drawing_data: spiral(), css_ppi: 132 };
    const store = fakeStore({
      drawings: { d1: { id: "d1", ...drawing }, d2: { id: "d2", ...drawing } },
      items: [{ drawing_id: "d1" }, { drawing_id: "d2" }],
      batch: { use_cache: false },
    });
    const runBackend = vi.fn(async () => ({ DOS: "fresh" }));
    await runWorker({ store, batchId: "b1", backends: BACKENDS, deadline: farDeadline(), runBackend });
    expect(runBackend).toHaveBeenCalledTimes(2);
    expect(store.state.items.every((it) => it.status === "done" && it.cache_hit === false)).toBe(true);
  });

  it("analyzes points sent inline without preparing them again", async () => {
    const drawData = [{ n: 1, x: 1, y: 150, p: 300, t: 0 }];
    const store = fakeStore({ items: [{ draw_data: drawData, input_hash: "abc" }] });
    const runBackend = vi.fn(async () => ({ DOS: "1" }));
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend });
    expect(runBackend.mock.calls[0][0].drawData).toBe(drawData);
    expect(store.state.items[0].status).toBe("done");
  });

  it("assumes iPad scaling when css_ppi was never recorded, and says so", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(), css_ppi: null } },
      items: [{ drawing_id: "d1" }],
    });
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend: async () => ({}) });
    expect(store.state.items[0]).toMatchObject({ css_ppi: 132, css_ppi_assumed: true, status: "done" });
  });

  it("puts a retryable failure back in the queue, then fails it on the last attempt", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(), css_ppi: 132 } },
      items: [{ drawing_id: "d1" }],
    });
    const runBackend = async () => {
      throw new BackendError("Backend returned 503", { retryable: true, status: 503 });
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const [item] = await store.claim("b1", { limit: 1 });
      expect(item.attempts).toBe(attempt);
      await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend });
    }

    expect(store.state.items[0]).toMatchObject({ status: "failed", error: "Backend returned 503" });
  });

  it("fails a non-retryable backend error at once", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(), css_ppi: 132 } },
      items: [{ drawing_id: "d1" }],
    });
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, {
      store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(),
      runBackend: async () => { throw new BackendError("Backend returned 400: bad input", { status: 400 }); },
    });
    expect(store.state.items[0].status).toBe("failed");
  });

  it("gives the backend its full timeout and counts a timeout as an attempt", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(), css_ppi: 132 } },
      items: [{ drawing_id: "d1" }],
    });
    const [item] = await store.claim("b1", { limit: 1 });
    let usedTimeout;
    await processItem(item, {
      store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(),
      runBackend: async ({ timeoutMs }) => {
        usedTimeout = timeoutMs;
        throw new BackendError("Backend did not answer within 120s", { retryable: true, timedOut: true });
      },
    });
    expect(usedTimeout).toBe(BACKEND_TIMEOUT_MS);
    expect(store.state.items[0]).toMatchObject({ status: "queued", attempts: 1 });
  });

  it("skips drawings with constant pressure when the batch excludes them", async () => {
    const store = fakeStore({
      drawings: { d1: { id: "d1", drawing_data: spiral(60, () => 500), css_ppi: 132 } },
      items: [{ drawing_id: "d1" }],
      batch: { options: { excludeFallbackPressure: true } },
    });
    const runBackend = vi.fn();
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend });
    expect(store.state.items[0].status).toBe("skipped");
    expect(runBackend).not.toHaveBeenCalled();
  });

  it("fails a row whose drawing no longer exists", async () => {
    const store = fakeStore({ items: [{ drawing_id: "gone" }] });
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend: vi.fn() });
    expect(store.state.items[0]).toMatchObject({ status: "failed", error: expect.stringMatching(/not found/) });
  });

  it("fails a row for a backend this server does not have", async () => {
    const store = fakeStore({ items: [{ drawing_id: "d1", backend: "python" }] });
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend: vi.fn() });
    expect(store.state.items[0]).toMatchObject({ status: "failed", error: expect.stringMatching(/python/) });
  });
});

describe("runWorker", () => {
  it("does nothing for a batch that is not running", async () => {
    const store = fakeStore({ items: [{ drawing_id: "d1" }], batch: { status: "completed" } });
    const runBackend = vi.fn();
    expect(await runWorker({ store, batchId: "b1", backends: BACKENDS, deadline: farDeadline(), runBackend })).toEqual({ processed: 0, drained: true });
    expect(runBackend).not.toHaveBeenCalled();
  });

  it("stops claiming when its budget runs low and reports work left", async () => {
    const drawings = { d1: { id: "d1", drawing_data: spiral(), css_ppi: 132 } };
    const store = fakeStore({
      drawings,
      items: [{ drawing_id: "d1" }, { drawing_id: "d1" }, { drawing_id: "d1" }],
      batch: { use_cache: false },
    });
    let clock = 0;
    const now = () => clock;
    const runBackend = async () => {
      clock += 100_000; // MATLAB-slow call
      return {};
    };
    // 280 s budget: starts at 0 s and 100 s; at 200 s too little is left for a full call.
    const outcome = await runWorker({ store, batchId: "b1", backends: BACKENDS, deadline: 280_000, now, runBackend });
    expect(outcome).toEqual({ processed: 2, drained: false });
    expect(store.state.items.map((it) => it.status)).toEqual(["done", "done", "queued"]);
  });
});

describe("summarizeProgress", () => {
  it("totals rows and flags a stalled batch", () => {
    const s = summarizeProgress([
      { backend: "matlab", status: "done", items: 8, cache_hits: 3, live_leases: 0, expired_leases: 0 },
      { backend: "matlab", status: "queued", items: 2, cache_hits: 0, live_leases: 0, expired_leases: 0 },
    ]);
    expect(s).toMatchObject({ total: 10, percent: 80, cacheHits: 3, isFinished: false, isStalled: true });
    expect(s.byBackend.matlab).toMatchObject({ done: 8, queued: 2 });
  });

  it("is not stalled while a worker holds a live lease", () => {
    const s = summarizeProgress([
      { backend: "matlab", status: "running", items: 1, cache_hits: 0, live_leases: 1, expired_leases: 0 },
      { backend: "matlab", status: "queued", items: 5, cache_hits: 0, live_leases: 0, expired_leases: 0 },
    ]);
    expect(s.isStalled).toBe(false);
  });

  it("is finished when nothing is queued or running", () => {
    const s = summarizeProgress([
      { backend: "matlab", status: "done", items: 4, cache_hits: 0, live_leases: 0, expired_leases: 0 },
      { backend: "matlab", status: "failed", items: 1, cache_hits: 0, live_leases: 0, expired_leases: 0 },
    ]);
    expect(s).toMatchObject({ isFinished: true, percent: 100 });
  });
});

describe("synthetic spiral rows", () => {
  it("draw the spiral from its recipe, then analyze it like any other row", async () => {
    const store = fakeStore({ items: [{ spec: { loops: 3, tremor: { freqHz: 5, amplitudeCm: 0.1, axisDeg: 45 } } }] });
    const runBackend = vi.fn(async () => ({ DOS: "1" }));
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend });
    expect(store.state.items[0]).toMatchObject({ status: "done", css_ppi: 132, result: { DOS: "1" } });
    expect(runBackend.mock.calls[0][0].drawData.length).toBeGreaterThan(900);
  });

  it("fail a recipe that cannot be drawn", async () => {
    const store = fakeStore({ items: [{ spec: { loops: -1 } }] });
    const [item] = await store.claim("b1", { limit: 1 });
    await processItem(item, { store, batch: store.state.batch, backends: BACKENDS, deadline: farDeadline(), runBackend: vi.fn() });
    expect(store.state.items[0]).toMatchObject({ status: "failed", error: expect.stringMatching(/Could not draw/) });
  });
});
