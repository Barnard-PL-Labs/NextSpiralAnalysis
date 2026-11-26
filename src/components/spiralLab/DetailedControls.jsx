"use client";
// The detailed view: every setting the generator has.
import styles from "@/styles/SpiralLab.module.css";
import { Section, Segmented, Slider } from "@/components/spiralLab/Controls";
import { PRESET_GROUPS, fitLimits, presetSettings } from "@/lib/spiralLab";

export default function DetailedControls({ settings, setSettings }) {
  const s = settings;
  const set = (key) => (value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const limits = fitLimits(s);

  return (
    <aside className={styles.card} aria-label="Spiral settings">
      <Section title="Start from">
        <select
          className={styles.select}
          value=""
          aria-label="Load a preset"
          onChange={(e) => e.target.value && setSettings((prev) => ({ ...presetSettings(e.target.value), seed: prev.seed }))}
        >
          <option value="">Load a preset…</option>
          {PRESET_GROUPS.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Section>

      <Section title="Shape">
        <Slider label="Loops" value={s.loops} onChange={set("loops")} min={1} max={10} step={0.25} limit={limits.loops} />
        <Slider label="Spacing, first loop" value={s.spacingStart} onChange={set("spacingStart")} min={0.2} max={2} step={0.05} unit="cm" limit={limits.spacingStart} />
        <Slider
          label="Spacing, last loop"
          value={s.spacingEnd}
          onChange={set("spacingEnd")}
          min={0.2}
          max={2}
          step={0.05}
          unit="cm"
          limit={limits.spacingEnd}
          hint="Smaller than the first loop: the spiral tightens as it grows."
        />
        <Slider label="Start radius" value={s.startRadius} onChange={set("startRadius")} min={0} max={1.5} step={0.05} unit="cm" limit={limits.startRadius} />
        <Segmented
          label="Direction"
          value={s.direction}
          onChange={set("direction")}
          options={[
            { value: "ccw", label: "Anticlockwise" },
            { value: "cw", label: "Clockwise" },
          ]}
        />
        <Slider label="Start angle" value={s.startAngle} onChange={set("startAngle")} min={0} max={359} step={1} unit="°" digits={0} hint="0° = pen starts to the right of centre." />
      </Section>

      <Section title="Timing">
        <Slider label="Duration" value={s.duration} onChange={set("duration")} min={1} max={30} step={0.5} unit="s" />
        <Segmented
          label="Pen moves at"
          value={s.speedProfile}
          onChange={set("speedProfile")}
          options={[
            { value: "constant-speed", label: "Steady speed" },
            { value: "constant-turn-rate", label: "Steady turning" },
          ]}
        />
        <Slider
          label="Speed at end vs start"
          value={s.endSpeedRatio}
          onChange={set("endSpeedRatio")}
          min={0.25}
          max={3}
          step={0.05}
          unit="×"
          hint="Below 1 slows down towards the end, above 1 speeds up."
        />
        <Slider label="Sample rate" value={s.sampleHz} onChange={set("sampleHz")} min={30} max={480} step={1} unit="Hz" digits={0} hint="Points recorded per second." />
        <Slider label="Timing jitter" value={s.timingJitter} onChange={set("timingJitter")} min={0} max={5} step={0.1} unit="ms" />
      </Section>

      <Section
        title="Tremor"
        disabled={!s.tremorOn}
        toggle={
          <label className={styles.toggle}>
            <input type="checkbox" checked={s.tremorOn} onChange={(e) => set("tremorOn")(e.target.checked)} />
            Add tremor
          </label>
        }
      >
        <Slider label="Frequency" value={s.tremorFreq} onChange={set("tremorFreq")} min={1} max={15} step={0.1} unit="Hz" hint="Parkinson's rest tremor ≈ 4–6 Hz, essential tremor ≈ 6–12 Hz." />
        <Slider
          label="Size (peak)"
          value={s.tremorAmp}
          onChange={set("tremorAmp")}
          min={0.01}
          max={0.5}
          step={0.01}
          unit="cm"
          limit={limits.tremorAmp}
          hint={`Swings ${(s.tremorAmp * 10).toFixed(1)} mm each way from the path.`}
        />
        <Slider label="Direction" value={s.tremorAxis} onChange={set("tremorAxis")} min={0} max={179} step={1} unit="°" digits={0} hint="0° = side to side, 90° = up and down." />
      </Section>

      <Section title="Hand and pen">
        <Slider label="Hand jitter" value={s.noise} onChange={set("noise")} min={0} max={0.1} step={0.005} unit="cm" digits={3} limit={limits.noise} hint="Random wobble on every point (standard deviation)." />
        <Segmented
          label="Pressure"
          value={s.pressureMode}
          onChange={set("pressureMode")}
          options={[
            { value: "varying", label: "Stylus" },
            { value: "constant", label: "Flat" },
          ]}
          hint={s.pressureMode === "constant" ? "A finger, mouse or trackpad records one flat value (usually 500)." : null}
        />
        {s.pressureMode === "constant" ? (
          <Slider label="Pressure" value={s.pressureConstant} onChange={set("pressureConstant")} min={0} max={1000} step={1} digits={0} />
        ) : (
          <>
            <Slider label="Typical pressure" value={s.pressureBase} onChange={set("pressureBase")} min={1} max={1000} step={1} digits={0} />
            <Slider label="Pressure swing" value={s.pressureSwing} onChange={set("pressureSwing")} min={0} max={500} step={1} digits={0} />
          </>
        )}
      </Section>

      <Section title="Device">
        <Segmented
          label="Screen"
          value={[132, 112].includes(s.cssPpi) ? s.cssPpi : "custom"}
          onChange={(v) => v !== "custom" && set("cssPpi")(v)}
          options={[
            { value: 132, label: "iPad" },
            { value: 112, label: "MacBook" },
            { value: "custom", label: "Other" },
          ]}
        />
        <Slider
          label="CSS pixels per inch"
          value={s.cssPpi}
          onChange={set("cssPpi")}
          min={60}
          max={300}
          step={1}
          digits={0}
          hint="Device PPI ÷ devicePixelRatio. Only changes how points are stored, not the spiral's real size."
        />
      </Section>

      <Section title="Randomness">
        <div className={styles.fieldTop}>
          <span className={styles.label}>Seed</span>
          <span className={styles.numberWrap}>
            <input
              className={styles.number}
              type="number"
              value={s.seed}
              aria-label="Seed"
              onChange={(e) => Number.isFinite(Number(e.target.value)) && set("seed")(Math.trunc(Number(e.target.value)))}
            />
            <button type="button" className={styles.button} onClick={() => set("seed")(Math.floor(Math.random() * 1_000_000))}>
              New
            </button>
          </span>
        </div>
        <div className={styles.hint}>Same seed, same spiral. Change it to redraw the same spec with fresh jitter.</div>
      </Section>
    </aside>
  );
}
