"use client";
// The simple view: only what defines a spiral at a glance -- how many loops,
// how far apart, how long it takes, and how much tremor.
import styles from "@/styles/SpiralLab.module.css";
import { Choices, Section, Slider } from "@/components/spiralLab/Controls";
import {
  START_PRESETS,
  TREMOR_LEVELS,
  applyTremorLevel,
  detailedChanges,
  fitLimits,
  matchesPreset,
  presetSettings,
  resetDetailed,
  tremorLevel,
} from "@/lib/spiralLab";


export default function SimpleControls({ settings, setSettings, onOpenDetailed }) {
  const s = settings;
  const set = (key) => (value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const level = tremorLevel(s);
  const changes = detailedChanges(s);
  const limits = fitLimits(s);
  const tremorChoices = TREMOR_LEVELS.map((l) => ({
    value: l.id,
    label: l.label,
    sub: l.amp == null ? "steady hand" : `±${(l.amp * 10).toFixed(1)} mm`,
    warn: l.amp != null && l.amp > limits.tremorAmp + 1e-9 ? "This much tremor would push the spiral past the canvas edge" : null,
  }));

  return (
    <aside className={styles.card} aria-label="Spiral settings">
      <Section title="Start from">
        <div className={styles.chips} role="group" aria-label="Start from">
          {START_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.chip}
              aria-pressed={matchesPreset(s, p.id)}
              onClick={() => setSettings((prev) => ({ ...presetSettings(p.id), seed: prev.seed }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="The spiral">
        <Slider label="Loops" value={s.loops} onChange={set("loops")} min={2} max={8} step={0.5} limit={limits.loops} hint="How many times the pen goes round." />
        <Slider
          label="Space between loops"
          value={s.spacingStart}
          onChange={(v) => setSettings((prev) => ({ ...prev, spacingStart: v, spacingEnd: v }))}
          min={0.3}
          max={1.5}
          step={0.05}
          unit="cm"
          limit={limits.spacingBoth}
          hint="The width of each ring."
        />
        <Slider label="Drawing time" value={s.duration} onChange={set("duration")} min={2} max={20} step={0.5} unit="s" hint="How long the whole spiral takes to draw." />
      </Section>

      <Section title="Tremor">
        <Choices label="How shaky" options={tremorChoices} value={level} onChange={(id) => setSettings((prev) => applyTremorLevel(prev, id))} />
        {level === "custom" && (
          <div className={styles.hint}>Size set in the detailed view: ±{(s.tremorAmp * 10).toFixed(1)} mm. Pick a level to replace it.</div>
        )}
        {s.tremorOn && (
          <Slider
            label="Shakes per second"
            value={s.tremorFreq}
            onChange={set("tremorFreq")}
            min={3}
            max={12}
            step={0.5}
            unit="Hz"
            hint="Parkinson's rest tremor ≈ 4–6 Hz; essential tremor ≈ 6–12 Hz."
          />
        )}
      </Section>

      {changes.length > 0 && (
        <div className={styles.note}>
          Also using detailed settings: {changes.join(", ")}.{" "}
          <button type="button" className={styles.linkButton} onClick={() => setSettings((prev) => resetDetailed(prev))}>
            Reset them
          </button>
        </div>
      )}

      <button type="button" className={`${styles.linkButton} ${styles.moreLink}`} onClick={onOpenDetailed}>
        More settings in the detailed view →
      </button>
    </aside>
  );
}
