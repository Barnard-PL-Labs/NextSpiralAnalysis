import { DEFAULT_SPIRAL, SPIRAL_PRESETS, generateSpiral } from "./syntheticSpiral";
import {
  DEFAULT_SETTINGS,
  applyTremorLevel,
  buildHash,
  compareToTruth,
  decodeSettings,
  describeSpiral,
  detailedChanges,
  encodeSettings,
  fitLimits,
  matchesPreset,
  PRESET_GROUPS,
  START_PRESETS,
  optionsToSettings,
  parseHash,
  presetSettings,
  resetDetailed,
  settingsToOptions,
  tremorLevel,
} from "./spiralLab";

describe("settings", () => {
  it("round-trip every preset through the controls without changing the spiral", () => {
    for (const preset of Object.values(SPIRAL_PRESETS)) {
      const options = { ...DEFAULT_SPIRAL, ...preset };
      const viaSettings = settingsToOptions(optionsToSettings(options));
      expect(generateSpiral(viaSettings).points).toEqual(generateSpiral(options).points);
    }
  });

  it("survive a shareable link", () => {
    const s = { ...presetSettings("tremor-5hz-3mm"), loops: 5.5, direction: "cw", seed: 42 };
    expect(decodeSettings(encodeSettings(s))).toEqual(s);
  });

  it("ignore unknown or wrongly typed keys in a link", () => {
    const decoded = decodeSettings(encodeURIComponent(JSON.stringify({ loops: "lots", evil: 1, seed: 9 })));
    expect(decoded).toEqual({ ...DEFAULT_SETTINGS, seed: 9 });
    expect(decodeSettings("%%%not json")).toBeNull();
  });
});

describe("compareToTruth", () => {
  const truth = generateSpiral({ tremor: { freqHz: 5, amplitudeCm: 0.1, axisDeg: 45 } }).truth;

  it("marks values within tolerance as matching", () => {
    const rows = compareToTruth(
      { "overall average of widths": "0.81", "number of cycles": "4", "traxis_fr1": "5.04", "traxis_dir1": "-135", "Cal Tremor": 1 },
      truth
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.verdict]));
    expect(byKey).toMatchObject({
      "overall average of widths": "match",
      "number of cycles": "match",
      traxis_fr1: "match",
      traxis_dir1: "match", // same axis, other way along it
      "Cal Tremor": "match",
    });
  });

  it("flags wrong and missing values", () => {
    const rows = compareToTruth({ "overall average of widths": "No Axis", "number of cycles": "3" }, truth);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.verdict]));
    expect(byKey["overall average of widths"]).toBe("missing");
    expect(byKey["number of cycles"]).toBe("off");
  });

  it("does not judge tremor metrics when no tremor was drawn", () => {
    const rows = compareToTruth({ traxis_fr1: "No Axis", "Cal Tremor": 0 }, generateSpiral().truth);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.verdict]));
    expect(byKey.traxis_fr1).toBeNull();
    expect(byKey["Cal Tremor"]).toBe("match");
  });
});

describe("simple view helpers", () => {
  it("maps tremor sizes to levels and back", () => {
    expect(tremorLevel(DEFAULT_SETTINGS)).toBe("none");
    const moderate = applyTremorLevel(DEFAULT_SETTINGS, "moderate");
    expect(moderate).toMatchObject({ tremorOn: true, tremorAmp: 0.15 });
    expect(tremorLevel(moderate)).toBe("moderate");
    expect(tremorLevel({ ...moderate, tremorAmp: 0.22 })).toBe("custom");
    expect(applyTremorLevel(moderate, "none").tremorOn).toBe(false);
  });

  it("lists detailed settings that are in use, and resets only those", () => {
    expect(detailedChanges(DEFAULT_SETTINGS)).toEqual([]);
    const s = { ...DEFAULT_SETTINGS, loops: 6, direction: "cw", noise: 0.02, spacingEnd: 0.5, pressureMode: "constant" };
    expect(detailedChanges(s)).toEqual(["spacing that changes across loops", "direction", "hand jitter", "pressure"]);
    const reset = resetDetailed(s);
    expect(reset.loops).toBe(6);
    expect(detailedChanges(reset)).toEqual([]);
  });

  it("ignores tremor direction while tremor is off", () => {
    expect(detailedChanges({ ...DEFAULT_SETTINGS, tremorAxis: 90 })).toEqual([]);
  });

  it("describes a spiral in one sentence", () => {
    expect(describeSpiral(DEFAULT_SETTINGS)).toBe("4 loops, 0.8 cm apart, drawn anticlockwise in 8 s, with no tremor.");
    const busy = { ...applyTremorLevel(DEFAULT_SETTINGS, "strong"), spacingEnd: 0.5, endSpeedRatio: 0.5, pressureMode: "constant" };
    expect(describeSpiral(busy)).toBe(
      "4 loops, 0.8 cm apart at the centre, 0.5 cm at the edge, drawn anticlockwise in 8 s, with a 5 Hz tremor swinging 3 mm each way; slowing to 0.5× speed, flat pressure (no stylus)."
    );
  });
});

describe("link fragment", () => {
  it("round-trips view and settings", () => {
    const settings = { ...DEFAULT_SETTINGS, loops: 5 };
    expect(parseHash(buildHash({ view: "detailed", settings }))).toEqual({ view: "detailed", settings });
    expect(buildHash({ view: "simple", settings: DEFAULT_SETTINGS })).toBe("");
  });

  it("still reads links made before the view existed", () => {
    expect(parseHash(`#s=${encodeSettings({ ...DEFAULT_SETTINGS, loops: 7 })}`).settings.loops).toBe(7);
  });
});

describe("fitLimits", () => {
  it("gives the largest value of each setting that still fits the canvas", () => {
    const l = fitLimits(DEFAULT_SETTINGS); // 4 loops, 0.8 cm apart, starting 0.2 cm out
    expect(l.fits).toBe(true);
    expect(l.loops).toBeCloseTo(6, 9);
    expect(l.spacingBoth).toBeCloseTo(1.2, 9);
    expect(l.startRadius).toBeCloseTo(1.8, 9);
    expect(l.noise).toBeCloseTo(1.6 / 3, 9); // (5 - 0.2 - 3.2) / 3
  });

  it("puts the spiral exactly at the edge when a setting is at its limit", () => {
    const base = { ...applyTremorLevel(DEFAULT_SETTINGS, "moderate"), spacingEnd: 0.6, noise: 0.01 };
    const l = fitLimits(base);
    for (const [key, patch] of [
      ["loops", { loops: l.loops }],
      ["spacingStart", { spacingStart: l.spacingStart }],
      ["spacingEnd", { spacingEnd: l.spacingEnd }],
      ["spacingBoth", { spacingStart: l.spacingBoth, spacingEnd: l.spacingBoth }],
      ["startRadius", { startRadius: l.startRadius }],
      ["tremorAmp", { tremorAmp: l.tremorAmp }],
      ["noise", { noise: l.noise }],
    ]) {
      const truth = generateSpiral(settingsToOptions({ ...base, ...patch })).truth;
      expect(truth.reachCm, key).toBeCloseTo(5, 9);
    }
  });

  it("reports when a spiral does not fit", () => {
    expect(fitLimits({ ...DEFAULT_SETTINGS, loops: 8 }).fits).toBe(false);
  });
});

describe("preset catalogue", () => {
  it("lists every preset exactly once, with a readable name", () => {
    const listed = PRESET_GROUPS.flatMap((g) => g.presets.map((p) => p.id));
    expect([...listed].sort()).toEqual(Object.keys(SPIRAL_PRESETS).sort());
    expect(new Set(listed).size).toBe(listed.length);
    PRESET_GROUPS.flatMap((g) => g.presets).forEach((p) => expect(p.label).not.toMatch(/-/));
  });

  it("keeps every Start here spiral on the canvas", () => {
    START_PRESETS.forEach((p) => expect(fitLimits(presetSettings(p.id)).fits).toBe(true));
  });

  it("recognises a preset whatever the seed", () => {
    expect(matchesPreset({ ...presetSettings("slow-tremor"), seed: 77 }, "slow-tremor")).toBe(true);
    expect(matchesPreset(presetSettings("slow-tremor"), "fast-tremor")).toBe(false);
  });

  it("can link to the batch view", () => {
    expect(parseHash(buildHash({ view: "batch", settings: DEFAULT_SETTINGS })).view).toBe("batch");
  });
});
