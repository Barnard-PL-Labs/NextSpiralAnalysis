import { generateSpiral } from "./syntheticSpiral";
import { applyTremorLevel, presetSettings, settingsToOptions } from "./spiralLab";
import { COPY_JITTER_CM, batchToCsv, countSpirals, estimateMinutes, expandBatch, jobsFromServerRows, summarizeBatch, toApiSpirals } from "./spiralBatch";

const items = [
  { id: "a", label: "Steady hand", presetId: "baseline", settings: presetSettings("baseline"), copies: 3 },
  { id: "b", label: "Slow tremor", presetId: "slow-tremor", settings: presetSettings("slow-tremor"), copies: 2 },
];

describe("expandBatch", () => {
  it("makes one job per copy, each with its own seed", () => {
    const jobs = expandBatch(items);
    expect(jobs.map((j) => j.key)).toEqual(["a:1", "a:2", "a:3", "b:1", "b:2"]);
    expect(jobs.filter((j) => j.itemId === "a").map((j) => j.settings.seed)).toEqual([1, 2, 3]);
    expect(countSpirals(items)).toBe(5);
  });

  it("adds slight jitter so copies of a jitter-free spiral really differ", () => {
    const [first, second] = expandBatch(items);
    expect(first.addedJitter).toBe(true);
    expect(first.settings.noise).toBe(COPY_JITTER_CM);
    const a = generateSpiral(settingsToOptions(first.settings)).points;
    const b = generateSpiral(settingsToOptions(second.settings)).points;
    expect(a).not.toEqual(b);
  });

  it("leaves copies alone when asked, and never adds jitter to a single spiral", () => {
    expect(expandBatch(items, { varyCopies: false })[0].settings.noise).toBe(0);
    expect(expandBatch([{ ...items[0], copies: 1 }])[0].addedJitter).toBe(false);
  });

  it("estimates time at four spirals at once", () => {
    expect(estimateMinutes(8)).toBeCloseTo((2 * 35) / 60);
  });
});

describe("summarizeBatch", () => {
  const truthFor = (s) => generateSpiral(settingsToOptions(s)).truth;
  const jobs = expandBatch(items).map((j, i) => ({
    ...j,
    status: i === 4 ? "failed" : "done",
    truth: truthFor(j.settings),
    result:
      j.itemId === "a"
        ? { "overall average of widths": 0.8, "number of cycles": 3, "Cal Tremor": 0, DOS: 0.01 + i * 0.01 }
        : { "overall average of widths": 0.81, "number of cycles": 4, "Cal Tremor": 1, traxis_fr1: 5.04, DOS: 2 },
  }));

  it("counts matches and spreads per type", () => {
    const [steady, tremor] = summarizeBatch(items, jobs);
    expect(steady).toMatchObject({ total: 3, done: 3, failed: 0 });
    expect(steady.checks.spacing).toMatchObject({ matched: 3, judged: 3 });
    expect(steady.checks.loops).toMatchObject({ matched: 0, judged: 3, mean: 3 });
    expect(steady.spread.DOS.mean).toBeCloseTo(0.02);
    expect(steady.spread.DOS.sd).toBeCloseTo(0.01);
    expect(tremor).toMatchObject({ total: 2, done: 1, failed: 1 });
    expect(tremor.checks.tremorFreq).toMatchObject({ truth: 5, matched: 1, judged: 1 });
  });

  it("writes one CSV row per finished spiral", () => {
    const csv = batchToCsv(jobs).trim().split("\r\n");
    expect(csv).toHaveLength(6);
    expect(csv[0].startsWith("type,preset,copy,status")).toBe(true);
    expect(csv[1].startsWith("Steady hand,baseline,1,done")).toBe(true);
  });
});

describe("mixed batch", () => {
  it("can hold a custom spiral alongside presets", () => {
    const custom = { id: "c", label: "Your spiral", presetId: null, settings: applyTremorLevel(presetSettings("wide"), "strong"), copies: 1 };
    expect(expandBatch([custom])[0]).toMatchObject({ presetId: null, label: "Your spiral" });
  });
});

describe("batch API round trip", () => {
  const two = [
    { id: "a", label: "Slow tremor", presetId: "slow-tremor", settings: presetSettings("slow-tremor"), copies: 2 },
    { id: "b", label: "Slow tremor", presetId: null, settings: presetSettings("wide"), copies: 1 },
  ];

  it("sends each copy with its type name, keeping names unique", () => {
    const sent = toApiSpirals(two);
    expect(sent.map((s) => [s.ref, s.label])).toEqual([
      ["Slow tremor #1", "Slow tremor"],
      ["Slow tremor #2", "Slow tremor"],
      ["Slow tremor (2) #1", "Slow tremor (2)"],
    ]);
    expect(sent[0].options.tremor).toMatchObject({ freqHz: 5 });
  });

  it("rebuilds types, copies and answers from the server's rows alone", () => {
    const rows = toApiSpirals(two).map((s, i) => ({
      ref: s.ref,
      label: s.label,
      spec: s.options,
      status: i === 2 ? "failed" : "done",
      result: i === 2 ? null : { "overall average of widths": 0.8, "number of cycles": 3, "Cal Tremor": 1, traxis_fr1: 5.04, DOS: 1.7 },
      error: i === 2 ? "boom" : null,
      duration_ms: 30000,
    }));
    const { items, jobs } = jobsFromServerRows(rows);
    expect(items.map((it) => [it.label, it.copies])).toEqual([
      ["Slow tremor", 2],
      ["Slow tremor (2)", 1],
    ]);
    expect(jobs[1]).toMatchObject({ copy: 2, status: "done", seconds: 30 });
    expect(jobs[0].truth.tremorFreqHz).toBe(5);
    const [tremor, wide] = summarizeBatch(items, jobs);
    expect(tremor.checks.tremorFreq).toMatchObject({ matched: 2, judged: 2 });
    expect(wide).toMatchObject({ done: 0, failed: 1 });
  });
});
