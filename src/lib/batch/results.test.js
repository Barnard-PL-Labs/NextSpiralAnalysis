// @vitest-environment node
import { csvStream, itemsToCsv, scalarMetrics } from "./results";

describe("itemsToCsv", () => {
  it("writes one row per item with the union of metric columns", () => {
    const csv = itemsToCsv([
      { drawing_id: "d1", backend: "matlab", status: "done", result: { DOS: "1.5", Tightness: 2 } },
      { drawing_id: "d1", backend: "python", status: "failed", error: 'Backend said "no", twice', result: null },
    ]);
    const [header, first, second] = csv.trim().split("\r\n");
    expect(header.endsWith(",DOS,Tightness")).toBe(true);
    expect(first.endsWith(",1.5,2")).toBe(true);
    expect(second).toContain('"Backend said ""no"", twice"');
  });

  it("keeps a metric whose name clashes with a base column", () => {
    const csv = itemsToCsv([{ status: "done", result: { status: "ok" } }]);
    expect(csv.split("\r\n")[0]).toContain("metric:status");
  });
});

describe("scalarMetrics", () => {
  it("drops nested values", () => {
    expect(scalarMetrics({ a: 1, b: "x", c: [1, 2], d: { e: 1 } })).toEqual({ a: 1, b: "x" });
  });
});

describe("csvStream", () => {
  it("streams the same bytes itemsToCsv builds", async () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ drawing_id: `d${i}`, status: "done", result: { DOS: i } }));
    const text = await new Response(csvStream(items, 3)).text();
    expect(text).toBe(itemsToCsv(items));
  });
});
