import { normalizePoints, parseSpiralFile, splitIntoParts, toBatchDrawing } from "./spiralImport";

const N = 200;
const pts = Array.from({ length: N }, (_, i) => ({ x: 100 + i, y: 200 - i, p: 400, t: i * 8 }));
const one = (text, name = "file") => {
  const r = parseSpiralFile(typeof text === "string" ? text : JSON.stringify(text), name);
  expect(r.error).toBeNull();
  return r.drawings;
};

describe("parseSpiralFile", () => {
  it("reads a plain array of points (the site's drawing_data)", () => {
    const [d] = one(pts.map((p, i) => ({ n: i + 1, ...p })));
    expect(d.points).toHaveLength(N);
    expect(d.points[1]).toEqual({ n: 2, x: 101, y: 199, p: 400, t: 8 });
    expect(d.notes).toEqual([]);
    expect(d.cssPpi).toBeNull();
  });

  it("accepts other field names", () => {
    const [d] = one(pts.map((p) => ({ X: p.x, Y: p.y, pressure: p.p, timestamp: 1_700_000_000_000 + p.t })));
    expect(d.points[1]).toMatchObject({ x: 101, y: 199, p: 400, t: 8 }); // rebased to start at 0
  });

  it("reads rows, in n,x,y,p,t and x,y,p,t order", () => {
    expect(one(pts.map((p, i) => [i + 1, p.x, p.y, p.p, p.t]))[0].points[1]).toMatchObject({ x: 101, y: 199, p: 400, t: 8 });
    expect(one(pts.map((p) => [p.x, p.y, p.p, p.t]))[0].points[1]).toMatchObject({ x: 101, y: 199, p: 400, t: 8 });
  });

  it("reads columns", () => {
    const [d] = one({ x: pts.map((p) => p.x), y: pts.map((p) => p.y), p: pts.map((p) => p.p), t: pts.map((p) => p.t) });
    expect(d.points[1]).toMatchObject({ x: 101, y: 199, t: 8 });
  });

  it("reads an object holding the points, with its cssPpi", () => {
    const [d] = one({ name: "patient 7", css_ppi: 112, drawing_data: pts });
    expect(d).toMatchObject({ name: "patient 7", cssPpi: 112 });
    expect(one({ ppi: 264, devicePixelRatio: 2, points: pts })[0].cssPpi).toBe(132);
  });

  it("joins strokes into one drawing", () => {
    const [d] = one({ strokes: [pts.slice(0, 100), pts.slice(100)] });
    expect(d.points).toHaveLength(N);
  });

  it("finds many drawings: a list, a Supabase export, a lab batch download", () => {
    expect(one([pts, pts, pts])).toHaveLength(3);
    const exported = one([
      { id: "a1", drawing_data: pts, css_ppi: 132 },
      { id: "b2", drawing_data: pts, css_ppi: 112 },
    ]);
    expect(exported.map((d) => [d.name, d.cssPpi])).toEqual([
      ["a1", 132],
      ["b2", 112],
    ]);
    const lab = one({ generator: "x", spirals: [{ type: "Slow tremor", copy: 1, cssPpi: 132, points: pts }, { type: "Slow tremor", copy: 2, cssPpi: 132, points: pts }] });
    expect(lab.map((d) => d.name)).toEqual(["Slow tremor #1", "Slow tremor #2"]);
  });

  it("reads JSON Lines", () => {
    const text = [JSON.stringify(pts), JSON.stringify({ points: pts })].join("\n");
    expect(one(text, "lines").map((d) => d.name)).toEqual(["lines #1", "lines #2"]);
  });

  it("says why a file cannot be used", () => {
    expect(parseSpiralFile("{not json", "bad").error).toMatch(/Not valid JSON/);
    expect(parseSpiralFile(JSON.stringify({ hello: "world" }), "empty").error).toMatch(/No spiral points/);
    const [tiny] = parseSpiralFile(JSON.stringify([{ x: 1, y: 1 }, { x: 2, y: 2 }]), "tiny").drawings;
    expect(tiny.error).toMatch(/Fewer than 3/);
  });
});

describe("normalizePoints", () => {
  it("fills in missing time and pressure, and says so", () => {
    const { points, notes } = normalizePoints(pts.map(({ x, y }) => ({ x, y })));
    expect(points[3]).toMatchObject({ t: 25, p: 500 });
    expect(notes.join(" ")).toMatch(/No timestamps.*No pressure/);
  });

  it("converts seconds to milliseconds and 0–1 pressure to 0–1000", () => {
    const { points, notes } = normalizePoints(pts.map((p) => ({ x: p.x, y: p.y, p: 0.4, t: p.t / 1000 })));
    expect(points[1]).toMatchObject({ t: 8, p: 400 });
    expect(notes).toHaveLength(2);
  });
});

describe("splitIntoParts", () => {
  it("keeps each part under the count and size limits", () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ ref: `d${i}`, points: pts }));
    const byCount = splitIntoParts(items, { maxCount: 100, maxBytes: 1e9 });
    expect(byCount.map((p) => p.length)).toEqual([100, 100, 50]);
    const maxBytes = JSON.stringify(items[0]).length * 30;
    const bySize = splitIntoParts(items, { maxCount: 100, maxBytes });
    bySize.forEach((part) => expect(part.reduce((n, it) => n + JSON.stringify(it).length, 0)).toBeLessThanOrEqual(maxBytes));
    expect(bySize.length).toBeGreaterThan(8);
    expect(bySize.flat()).toHaveLength(250);
  });

  it("builds the batch API's drawing entry, with a default screen PPI", () => {
    const d = one(pts)[0];
    expect(toBatchDrawing(d, { ref: "a", label: "folder", defaultPpi: 132 })).toMatchObject({ ref: "a", label: "folder", cssPpi: 132 });
  });
});
