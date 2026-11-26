// @vitest-environment node
import { parseBatchRequest, parseInlineDrawings } from "./submit";

const BACKENDS = { matlab: {}, python: {} };
const ID = "72f5e976-4b2d-41b5-8586-478241320cdf";

describe("parseBatchRequest", () => {
  it("applies defaults for a list of drawing ids", () => {
    const r = parseBatchRequest({ drawingIds: [ID, ID.toUpperCase()] }, BACKENDS);
    expect(r).toEqual({
      ok: true,
      value: {
        label: null,
        backends: ["matlab"],
        workers: 20,
        useCache: true,
        options: { excludeFallbackPressure: false },
        drawingIds: [ID],
      },
    });
  });

  it("requires exactly one source of drawings", () => {
    expect(parseBatchRequest({}, BACKENDS).ok).toBe(false);
    expect(parseBatchRequest({ drawingIds: [ID], query: {} }, BACKENDS).ok).toBe(false);
  });

  it("rejects unknown backends and says which exist", () => {
    const r = parseBatchRequest({ drawingIds: [ID], backends: ["julia"] }, BACKENDS);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/julia.*matlab, python/);
  });

  it("rejects malformed ids and out-of-range workers", () => {
    expect(parseBatchRequest({ drawingIds: ["1; drop table"] }, BACKENDS).ok).toBe(false);
    expect(parseBatchRequest({ drawingIds: [ID], workers: 500 }, BACKENDS).ok).toBe(false);
  });

  it("accepts a query with filters", () => {
    const r = parseBatchRequest(
      { query: { createdAfter: "2026-06-05", deviceRecognized: true, limit: 1000 }, backends: ["matlab", "python"] },
      BACKENDS
    );
    expect(r.ok).toBe(true);
    expect(r.value.query).toEqual({ createdAfter: "2026-06-05", createdBefore: null, deviceRecognized: true, limit: 1000 });
    expect(r.value.backends).toEqual(["matlab", "python"]);
  });

  it("rejects a bad query date", () => {
    expect(parseBatchRequest({ query: { createdAfter: "last tuesday" } }, BACKENDS).ok).toBe(false);
  });

  it("validates inline drawings", () => {
    expect(parseBatchRequest({ drawings: [{ points: [] }] }, BACKENDS).error).toMatch(/cssPpi/);
    const r = parseBatchRequest({ drawings: [{ points: [], cssPpi: 132 }] }, BACKENDS);
    expect(r.value.drawings).toEqual([{ ref: "0", label: null, points: [], cssPpi: 132 }]);
  });
});

describe("parseBatchRequest with spiral recipes", () => {
  it("accepts recipes and drops unknown settings", () => {
    const r = parseBatchRequest(
      { synthetic: [{ ref: "Slow tremor #1", label: "Slow tremor", options: { loops: 5, evil: "x" } }, { options: {} }] },
      BACKENDS
    );
    expect(r.ok).toBe(true);
    expect(r.value.synthetic).toEqual([
      { ref: "Slow tremor #1", label: "Slow tremor", options: { loops: 5 } },
      { ref: "1", label: null, options: {} },
    ]);
  });

  it("rejects a label that is not a short string", () => {
    expect(parseBatchRequest({ synthetic: [{ label: 5, options: {} }] }, BACKENDS).ok).toBe(false);
  });

  it("rejects a recipe that is not an object", () => {
    expect(parseBatchRequest({ synthetic: [{ options: "loops=5" }] }, BACKENDS).ok).toBe(false);
    expect(parseBatchRequest({ synthetic: [] }, BACKENDS).ok).toBe(false);
  });
});

describe("parseInlineDrawings", () => {
  it("keeps a label per drawing, for grouping uploaded files", () => {
    const r = parseInlineDrawings([{ ref: "a.json", label: "patients", points: [], cssPpi: 132 }]);
    expect(r).toEqual({ ok: true, value: [{ ref: "a.json", label: "patients", points: [], cssPpi: 132 }] });
  });

  it("points larger sets to the parts route", () => {
    const many = Array.from({ length: 101 }, () => ({ points: [], cssPpi: 132 }));
    expect(parseInlineDrawings(many).error).toMatch(/in parts/);
  });
});
