"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import styles from "@/styles/Directions.module.css";

const TOC = [
  { id: "what",    label: "What it is"  },
  { id: "how",     label: "How to use"  },
  { id: "metrics", label: "Key metrics" },
];


const METRICS = [
  {
    name: "DOS · Degree of Severity",
    pill: "0 – 4", type: "blue",
    body: "A comprehensive measure of overall spiral drawing performance, indicating the severity of motor impairment.",
  },
  {
    name: "Smoothness",
    pill: "< −4", type: "blue",
    body: "Evaluates the continuity and fluidity of the drawn spiral, reflecting the steadiness of hand movements.",
  },
  {
    name: "Tightness",
    pill: "≈ 1", type: "blue",
    body: "Measures how closely the spiral turns are drawn to each other, indicating control over fine motor movements.",
  },
  {
    name: "Pressure",
    pill: "qualitative", type: "gray",
    body: "Analyzes the force applied while drawing the spiral, which can reveal tremors or muscle weakness.",
  },
  {
    name: "Speed",
    pill: "15 – 25 cm/s", type: "blue",
    body: "Measures the velocity of drawing at different points in the spiral, providing insights into motor planning and execution.",
  },
  {
    name: "Frequency Analysis",
    pill: "qualitative", type: "gray",
    body: "Examines the rhythmic components of the drawing, which can help identify specific types of tremors.",
  },
];

const STEPS = [
  { text: <>Draw at least <strong>3–4 complete revolutions</strong>.</> },
  { text: <>Draw a spiral on the provided canvas using your mouse or touchscreen.</> },
  { text: <>Try to make the spiral as evenly spaced as possible.</> },
  { text: <>Try to maintain a consistent drawing speed and pressure.</> },
  { text: <>For best results, try to <strong>draw in a single, continuous motion</strong>.</> },
  { text: <>Click Save to proceed on to the next drawing.</> },
  { text: <>Click the &ldquo;Finish Analysis&rdquo; button to process your spiral.</> },
  { text: <>Review the results and graphs provided for insights into your upper limb motor control.</> },
  { text: <>Compare your results over time to track changes in your motor function!</> },
];

export default function DirectionsPage() {
  const [active, setActive] = useState("what");

  useEffect(() => {
    const observers = TOC.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActive(id); },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <>
      <Header showVideo={true} />
      <div className={styles.mainContainer}>
        <div className={styles.contentGrid}>

          <main>
            {/* 01 — What it is */}
            <section id="what" className={styles.section}>
              <p className={styles.eyebrow}>01 — WHAT IT IS</p>
              <h2 className={styles.sectionH2}>What is Spiral Analysis?</h2>
              <p className={styles.bodyText}>
                Spiral Analysis is a non-invasive system of quantifying motor function based on kinematic and physiologic features derived from handwritten spirals. Spiral Analysis uses a digitizing tablet and writing pen to record position, force and time measurements.
              </p>
              <p className={styles.bodyText}>
                Spiral Analysis is based on &ldquo;unraveling&rdquo; the two-dimensional drawn spiral picture into a data series that captures its original kinematic information and allows for further computational manipulations and clinical correlations. Spiral data are collected in the X, Y and pressure axes providing virtual &ldquo;tri-axial&rdquo; recordings. This effectively extends spiral drawing - a standard clinical test - into an objective and accurate measure of motor control. Mathematical formulations are used to create into indices that quantify the kinematic parameters, and assess many spiral features including overall degree of severity, shape, drawing speed, tightness of loops, irregularity and tremor. Over 70 indices are created, and multiple spirals can be averaged.
              </p>
              <p className={styles.bodyText}>
                Spiral Analysis provides more accuracy and objectivity than the clinical exam alone. It has already been used to study the details of normal motor control, to quantify normal and abnormal motor development and analyze movement disorders such as Parkinson&apos;s disease, tremors, dystonia, ataxia and functional movements. Because of its precision and reproducibility, Spiral Analysis is also useful in quantifying changes before and after medical or surgical treatments.
              </p>

              <p className={styles.cardGroupLabel}>Why use it</p>
              <div className={styles.benefitGrid}>
                {[
                  "Non-invasive and easy to administer",
                  "Provides real-time feedback",
                  "Tracks motor function over time",
                  "Highly sensitive to neuromotor changes",
                  "Useful for research and clinical assessments",
                ].map((text) => (
                  <div key={text} className={styles.benefitCard}>
                    <div className={styles.bullet} />
                    <span className={styles.benefitText}>{text}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 02 — How to use */}
            <section id="how" className={styles.section}>
              <p className={styles.eyebrow}>02 — HOW TO USE THIS TOOL</p>
              <h2 className={styles.sectionH2}>How to Use This Tool</h2>
              <div className={styles.stepsContainer}>
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    className={`${styles.step} ${i % 2 === 0 ? styles.stepOdd : styles.stepEven}`}
                  >
                    <span className={styles.stepNum}>{String(i + 1).padStart(2, "0")}</span>
                    <p className={styles.stepText}>{s.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 03 — Key metrics */}
            <section id="metrics" className={`${styles.section} ${styles.lastSection}`}>
              <p className={styles.eyebrow}>03 — KEY METRICS</p>
              <h2 className={styles.sectionH2}>Key Metrics in Spiral Analysis</h2>
              <p className={styles.metricsIntro}>
                Each card shows a <strong>normal reference range</strong> — the value expected for a healthy adult. Use these to interpret where your results fall.
              </p>
              <div className={styles.metricsGrid}>
                {METRICS.map((m) => (
                  <div key={m.name} className={styles.metricCard}>
                    <span className={styles.metricName}>{m.name}</span>
                    <p className={styles.metricBody}>{m.body}</p>
                    <div className={styles.metricFooter}>
                      <span className={styles.metricRangeLabel}>Normal range</span>
                      <span className={m.type === "blue" ? styles.pillBlue : styles.pillGray}>{m.pill}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Disclaimer */}
            <div className={styles.disclaimer}>
              <span className={styles.disclaimerIcon}>⚠</span>
              <p className={styles.disclaimerText}>
                Note: This tool is for educational purposes only. For medical concerns, always consult
                with a healthcare professional.
              </p>
            </div>
          </main>

          <aside>
            <nav className={styles.toc}>
              <p className={styles.tocLabel}>ON THIS PAGE</p>
              <ul className={styles.tocList}>
                {TOC.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={`${styles.tocItem} ${active === id ? styles.tocItemActive : ""}`}
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
    </>
  );
}
