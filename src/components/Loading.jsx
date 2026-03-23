"use client";
import styles from "@/styles/Loading.module.css";

export default function Loading() {
  return (
    <div
      className={styles.loaderContainer}
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <div className={styles.orbitSpinner}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={styles.orbitDot}
            style={{ transform: `rotate(${i * 45}deg) translateX(28px)` }}
          />
        ))}
      </div>
      <p className={styles.loadingText}>Calibrating Spiral Machine...</p>
    </div>
  );
}
