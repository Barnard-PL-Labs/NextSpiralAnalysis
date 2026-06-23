"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "@/styles/LearnMore.module.css";

// ── Procedural SVG helpers (module-level = no hydration mismatch) ────────────

function buildSpiralPath(turns = 4.5, b = 17, steps = 400) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const r = (b * t) / (2 * Math.PI);
    pts.push(`${i === 0 ? "M" : "L"}${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function buildWavePath(type, w = 320, h = 34, steps = 200) {
  const mid = h / 2;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const t = (i / steps) * 2 * Math.PI;
    let y;
    if (type === "x") {
      y = mid - Math.sin(t * 4.5) * 7;
    } else if (type === "y") {
      y = mid - Math.cos(t * 4.5) * 7;
    } else {
      const decay = Math.exp(-(i / steps) * 1.2);
      y = mid - (Math.sin(t * 9) * 6 + Math.sin(t * 14.1) * 2 + Math.sin(t * 5.7) * 1.5) * decay;
    }
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

const SPIRAL_PATH = buildSpiralPath();
const WAVE_X = buildWavePath("x");
const WAVE_Y = buildWavePath("y");
const WAVE_P = buildWavePath("p");

// ── Sub-components ───────────────────────────────────────────────────────────

function SpiralMark({ size = 25, strokeWidth = 1.5, dot = false }) {
  return (
    <svg width={size} height={size} viewBox="-95 -95 190 190" fill="none">
      <path d={SPIRAL_PATH} stroke="#2F6BD8" strokeWidth={strokeWidth} strokeLinecap="round" />
      {dot && <circle cx="0" cy="0" r="3.4" fill="#13917F" />}
    </svg>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────

const TOC_SECTIONS = [
  { id: "what",    label: "What it is"  },
  { id: "why",     label: "Why use it"  },
  { id: "how",     label: "How to use"  },
  { id: "metrics", label: "Key metrics" },
];

const BENEFIT_CARDS = [
  { title: "Non-invasive & easy to administer", body: "No wires or attachments — under two minutes on a consumer tablet." },
  { title: "Real-time feedback",                 body: "Indices are computed immediately after the drawing is captured." },
  { title: "Tracks change over time",            body: "Objective baselines make subtle progression visible across visits." },
  { title: "Highly sensitive",                   body: "Detects neuromotor changes too subtle for rating scales alone." },
];

const METRICS = [
  { name: "DOS · Degree of Severity", pill: "0 – 4",       type: "blue", body: "Unitless overall measure on a five-point scale: 0–0.99 normal, 1–1.99 mild, 2–2.99 moderate, 3–4 severely abnormal." },
  { name: "Smoothness",               pill: "< −4",         type: "blue", body: "Unitless continuity/variation from the ideal spiral shape; lower (more negative) is smoother." },
  { name: "Tightness",                pill: "≈ 1",          type: "blue", body: "How closely loops are drawn together, normalized to 5 loops in a 10×10 cm box." },
  { name: "Speed",                    pill: "15 – 25 cm/s", type: "blue", body: "Average drawing speed: distance between consecutive points over the spiral, divided by sampling time." },
  { name: "Pressure",                 pill: "force",        type: "gray", body: "Forces applied to the pen while drawing; can reveal otherwise hidden tremors." },
  { name: "Tremor",                   pill: "< 2",          type: "blue", body: "Detectable tremor above the noise baseline (>1 Hz) in the x, y, or pressure axes." },
  { name: "Width Variability",        pill: "< 0.250",      type: "blue", body: "Unitless correlate of drawing irregularity — loop-to-loop variability sampled every 5°." },
  { name: "Frequency Analysis",       pill: "spectral",     type: "gray", body: "Examines the rhythmic components and axes of tremor to help identify specific tremor types." },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LearnMorePage() {
  const [activeSection, setActiveSection] = useState("what");

  useEffect(() => {
    const observers = TOC_SECTIONS.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <SpiralMark size={25} />
          <span className={styles.navWordmark}>Spiral Analysis</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <a href="#metrics" className={styles.navLink}>Metrics</a>
          <Link href="/machine" className={styles.navCta}>Start an assessment</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        {/* decorative background spiral */}
        <div className={styles.heroDeco}>
          <svg width={420} height={420} viewBox="-95 -95 190 190" fill="none">
            <path d={SPIRAL_PATH} stroke="#2F6BD8" strokeWidth={1.2} strokeLinecap="round" />
          </svg>
        </div>

        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>LEARN MORE</p>
          <h1 className={styles.heroH1}>How Spiral Analysis quantifies motor control.</h1>
          <p className={styles.heroSub}>
            A non-invasive method that turns a handwritten spiral into objective, reproducible
            indices of neuromotor function — extending a standard clinical test into precise measurement.
          </p>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>70+</span>
              <span className={styles.heroStatLabel}>computed indices</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>&lt; 2 min</span>
              <span className={styles.heroStatLabel}>to complete</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>0</span>
              <span className={styles.heroStatLabel}>attachments needed</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.pageOuter}>
        <div className={styles.contentGrid}>

          {/* Left: content */}
          <main>

            {/* 01 — What it is */}
            <section id="what" className={styles.section}>
              <p className={styles.sectionEyebrow}>01 — WHAT IT IS</p>
              <h2 className={styles.sectionH2}>A handwritten spiral, turned into data.</h2>
              <p className={styles.bodyText}>
                Position, force, and time are recorded continuously as the patient draws on a digitizing
                tablet or touchscreen. The drawing is then &ldquo;unravelled&rdquo; into a data series across{" "}
                <strong>X, Y, and pressure axes</strong> — three independent signals extracted from a single gesture.
              </p>
              <p className={styles.bodyText}>
                More than <strong>70 indices</strong> are derived from these axes. When multiple spirals
                are drawn, the indices are averaged, reducing the effect of any single outlier drawing
                and improving reproducibility across sessions.
              </p>

              {/* Unravel visual */}
              <div className={styles.unravelCard}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <svg width={160} height={160} viewBox="-95 -95 190 190" fill="none">
                    <path d={SPIRAL_PATH} stroke="#2F6BD8" strokeWidth={2.4} strokeLinecap="round" />
                    <circle cx="0" cy="0" r="3.4" fill="#13917F" />
                  </svg>
                  <p className={styles.unravelCaption}>DRAWN SPIRAL</p>
                </div>
                <div>
                  {[
                    { label: "X AXIS",   path: WAVE_X, color: "#2F6BD8" },
                    { label: "Y AXIS",   path: WAVE_Y, color: "#1E4FA8" },
                    { label: "PRESSURE", path: WAVE_P, color: "#13917F" },
                  ].map(({ label, path, color }) => (
                    <div key={label} className={styles.waveRow}>
                      <p className={styles.waveLabel} style={{ color }}>{label}</p>
                      <svg viewBox="0 0 320 34" width="100%" style={{ display: "block" }}>
                        <path d={path} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 02 — Why use it */}
            <section id="why" className={styles.section}>
              <p className={styles.sectionEyebrow}>02 — WHY USE IT</p>
              <h2 className={styles.sectionH2} style={{ maxWidth: 520 }}>
                Greater accuracy and objectivity than the clinical exam alone.
              </h2>
              <div className={styles.cardGrid2x2}>
                {BENEFIT_CARDS.map((c) => (
                  <div key={c.title} className={styles.benefitCard}>
                    <div className={styles.bullet} />
                    <div>
                      <p className={styles.cardTitle}>{c.title}</p>
                      <p className={styles.cardBody}>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className={styles.closingNote}>
                Used to study normal motor control and movement disorders including Parkinson&apos;s
                disease, tremors, dystonia, ataxia, and functional movements. Quantifies change
                before and after treatment.
              </p>
            </section>

            {/* 03 — How to use */}
            <section id="how" className={styles.section}>
              <p className={styles.sectionEyebrow}>03 — HOW TO USE THE TOOL</p>
              <h2 className={styles.sectionH2} style={{ maxWidth: 480 }}>
                Draw, save, repeat, then finish.
              </h2>
              <div className={styles.stepsContainer}>
                {[
                  { n: "01", body: <><strong>3–4 complete revolutions</strong> on the canvas with a mouse or touchscreen.</> },
                  { n: "02", body: <>Keep the spiral as round and evenly spaced as possible, at a <strong>consistent speed and pressure</strong>.</> },
                  { n: "03", body: <>For best results, draw in a <strong>single, continuous motion</strong>. Click Save to proceed to the next drawing.</> },
                  { n: "04", body: <>Click <strong>Finish Analysis</strong> to process your spirals, then review the results and graphs.</> },
                  { n: "05", body: <>Compare results over time to <strong>track changes</strong> in motor function.</> },
                ].map((s, i) => (
                  <div key={s.n} className={`${styles.step} ${i % 2 === 0 ? styles.stepOdd : styles.stepEven}`}>
                    <span className={styles.stepNum}>{s.n}</span>
                    <p className={styles.stepText}>
                      {s.n === "01" ? <>Draw at least {s.body}</> : s.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 04 — Key metrics */}
            <section id="metrics" className={styles.section} style={{ borderBottom: "none", marginBottom: 0 }}>
              <p className={styles.sectionEyebrow}>04 — KEY METRICS</p>
              <h2 className={styles.sectionH2} style={{ maxWidth: 520 }}>
                The indices, and what counts as normal.
              </h2>
              <div className={styles.metricsGrid}>
                {METRICS.map((m) => (
                  <div key={m.name} className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricName}>{m.name}</span>
                      <span className={m.type === "blue" ? styles.pillBlue : styles.pillGray}>{m.pill}</span>
                    </div>
                    <p className={styles.metricBody}>{m.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Disclaimer */}
            <div className={styles.disclaimer}>
              <span style={{ fontSize: 18, color: "#1E4FA8", flexShrink: 0, lineHeight: 1.6 }}>⚠</span>
              <p className={styles.disclaimerText}>
                This tool is for educational purposes only. For medical concerns, always consult
                a qualified healthcare professional.
              </p>
            </div>

          </main>

          {/* Right: sticky TOC */}
          <aside>
            <nav className={styles.toc}>
              <p className={styles.tocLabel}>ON THIS PAGE</p>
              <ul className={styles.tocList}>
                {TOC_SECTIONS.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`${styles.tocItem} ${activeSection === id ? styles.tocItemActive : ""}`}
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

        </div>
      </div>

      {/* ── CTA ── */}
      <div className={styles.ctaSection}>
        <h2 className={styles.ctaH2}>Ready to capture your first spiral?</h2>
        <div className={styles.ctaButtons}>
          <Link href="/machine" className={styles.ctaPrimary}>Start an assessment</Link>
          <Link href="/" className={styles.ctaSecondary}>Back to home</Link>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <SpiralMark size={22} />
          <span className={styles.footerWordmark}>Spiral Analysis</span>
        </div>
        <span className={styles.footerCopy}>© 2026 · Non-invasive neuromotor assessment</span>
      </footer>
    </div>
  );
}
