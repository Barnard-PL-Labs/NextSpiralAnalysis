"use client";
// Small form controls shared by the spiral lab's simple and detailed views.
import styles from "@/styles/SpiralLab.module.css";

// Native range thumbs are about this wide; the track runs from half a thumb
// in from each end, so a mark at value v sits at this offset.
const THUMB_PX = 16;
const trackLeft = (pct) => `calc(${pct}% + ${((0.5 - pct / 100) * THUMB_PX).toFixed(2)}px)`;

const plain = (n, digits) => String(Number(n.toFixed(digits)));

// `limit` (optional): the largest value that keeps the spiral on the canvas.
// It is marked on the track, the part beyond it is tinted, and a line under
// the slider says what the limit is -- so nobody has to find it by trial.
export function Slider({ label, value, onChange, min, max, step, unit, hint, digits = 2, limit }) {
  const hasLimit = limit != null && Number.isFinite(limit) && limit < max;
  const neverFits = hasLimit && limit < min;
  const pct = hasLimit ? ((Math.max(min, limit) - min) / (max - min)) * 100 : 0;
  const over = hasLimit && value > limit + 1e-9;
  // Round down to the slider's step, so the stated value really does fit.
  const usable = hasLimit ? Math.floor(limit / step + 1e-9) * step : null;
  const limitLabel = hasLimit ? `${plain(usable, digits)}${unit ? ` ${unit}` : ""}` : null;

  return (
    <div className={styles.field}>
      <div className={styles.fieldTop}>
        <label className={styles.label}>{label}</label>
        <span className={styles.numberWrap}>
          <input
            className={`${styles.number} ${over ? styles.numberOver : ""}`}
            type="number"
            value={value}
            step={step}
            aria-label={label}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
            }}
          />
          {unit}
        </span>
      </div>
      <div className={styles.rangeWrap}>
        <input
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          aria-label={`${label} slider`}
          onChange={(e) => onChange(Number(Number(e.target.value).toFixed(digits)))}
        />
        {hasLimit && (
          <>
            <span className={styles.rangeOver} style={{ left: trackLeft(pct) }} aria-hidden="true" />
            {!neverFits && <span className={styles.rangeMark} style={{ left: trackLeft(pct) }} aria-hidden="true" />}
          </>
        )}
      </div>
      {hasLimit && (
        <div className={over ? styles.limitOver : styles.limitText}>
          {neverFits
            ? "Too big for the canvas at any value: make something else smaller."
            : over
              ? `Past the canvas edge. Fits up to ${limitLabel}.`
              : `Fits the canvas up to ${limitLabel}.`}
        </div>
      )}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

export function Segmented({ label, options, value, onChange, hint }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldTop}>
        <span className={styles.label}>{label}</span>
        <div className={styles.segmented} role="group" aria-label={label}>
          {options.map((o) => (
            <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

// Big, equal-width choices with a second line, for the simple view.
export function Choices({ label, options, value, onChange }) {
  return (
    <div className={styles.field}>
      <div className={styles.label} style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className={styles.choices} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`${styles.choice} ${o.warn ? styles.choiceWarn : ""}`}
            aria-pressed={value === o.value}
            title={o.warn || undefined}
            onClick={() => onChange(o.value)}
          >
            <span>{o.label}</span>
            {o.sub && <span className={styles.choiceSub}>{o.sub}</span>}
            {o.warn && <span className={styles.choiceWarnText}>won&apos;t fit</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, toggle, children, disabled }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        <span>{title}</span>
        {toggle}
      </div>
      <div className={disabled ? styles.disabled : undefined}>{children}</div>
    </div>
  );
}
