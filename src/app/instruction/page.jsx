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
    pill: "0 – 1", type: "blue",
    body: "A comprehensive measure of overall spiral drawing performance that correlates with a 0 - 4 clinical rating scale.",
  },
  {
    name: "2nd Order Smoothness",
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
    pill: "Dependent on the drawing tablet", type: "gray",
    body: "Measure of the pen force applied while drawing the spiral.",
  },
  {
    name: "Speed",
    pill: "15 – 25 cm/s", type: "blue",
    body: "Measures the velocity of drawing at different points in the spiral, providing insights into motor planning and execution.",
  },
  {
    name: "Tremor Analysis",
    pill: "None or low amplitude tremor", type: "gray",
    body: "Measure the amplitude, rhythm and axis components of the spiral drawing. This can help identify specific types of tremors.",
  },
  {
    name: "COV of Width",
    pill: "< 0.25", type: "blue",
    body: "A measure of loop-to-loop variability that correlates with ataxia or unsteadiness.",
  },
];

const STEPS = [
  { text: <>Using your finger on a mouse pad, or a stylus on a tablet, draw spirals within the 10x10 cm box.</> },
  { text: <>Start from the center of the box and draw spirals of about 4-5 loops.</> },
  { text: <>Be sure to draw for about 4-5 seconds to complete each spiral.</> },
  { text: <>Try to make the loops as evenly spaced as possible.</> },
  { text: <>Click &ldquo;Save&rdquo; after each spiral drawing.</> },
  { text: <>Click &ldquo;Analyze&rdquo; when you have finished.</> },
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
              <h2 className={styles.sectionH2}>What is Spiral Analysis?</h2>
              <p className={styles.bodyText}>
                Spiral Analysis is a non-invasive system of quantifying motor function based on kinematic and physiologic features derived from handwritten spirals. Spiral Analysis uses a digitizing tablet and writing pen to record position, force and time measurements.
              </p>
              <p className={styles.bodyText}>
                Spiral Analysis is based on &ldquo;unraveling&rdquo; the two-dimensional drawn spiral picture into a data series that captures its original kinematic information and allows for further computational manipulations and clinical correlations. Spiral data are collected in the X, Y and pressure axes providing virtual &ldquo;tri-axial&rdquo; recordings. This effectively extends spiral drawing - a standard clinical test - into an objective and accurate measure of motor control. Mathematical formulations are used to create indices that quantify the kinematic parameters, and assess many spiral features including overall degree of severity, shape, drawing speed, tightness of loops, irregularity and tremor. Over 70 indices are created, and multiple spirals can be averaged.
              </p>
              <p className={styles.bodyText}>
                Spiral Analysis provides accuracy and objectivity to the clinical exam. It has already been used to study the details of normal motor control, to quantify normal and abnormal motor development and analyze movement disorders such as Parkinson&apos;s disease, tremors, dystonia, ataxia and functional movements. Spiral Analysis is also useful in quantifying changes before and after medical, surgical, and other treatments.
              </p>

            </section>

            {/* 02 — How to use */}
            <section id="how" className={styles.section}>
              <p className={styles.eyebrow} style={{ visibility: "hidden" }}>02 — HOW TO USE</p>
              <h2 className={styles.sectionH2}>How to Take This Test</h2>
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
              <p className={styles.eyebrow} style={{ visibility: "hidden" }}>03 — KEY METRICS</p>
              <h2 className={styles.sectionH2}>Key Metrics in Spiral Analysis</h2>
              <p className={styles.metricsIntro}>
                Each card shows a <strong>normal reference range</strong> — the value expected for a healthy person. Use these to interpret where your results fall.
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
