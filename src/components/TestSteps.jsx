"use client";

import styles from "@/styles/Directions.module.css";

// Single source for the instructions. They appear both on their own page
// (/how-to-take-this-test) and inside Learn More, so keeping one copy stops the
// two from drifting apart.
export const STEPS = [
  { text: <>Using your finger on a mouse pad, or a stylus on a tablet, draw spirals within the 10x10 cm box.</> },
  { text: <>Start from the center of the box and draw spirals of about 4-5 loops.</> },
  { text: <>Be sure to draw for about 4-5 seconds to complete each spiral.</> },
  { text: <>Try to make the loops as evenly spaced as possible.</> },
  { text: <>Click &ldquo;Save&rdquo; after each spiral drawing.</> },
  { text: <>Click &ldquo;Start Analysis&rdquo; when you have finished.</> },
];

export default function TestSteps() {
  return (
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
  );
}
