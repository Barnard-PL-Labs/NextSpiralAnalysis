"use client";
import styles from "@/styles/Canvas.module.css";

export default function Buttons({
  onSaveAndAnalyze,
  onFinishEarly,
  savedDrawingsCount = 0,
  userFinished = false,
  isProcessingFinal = false,
}) {
  return (
    <div className={styles.buttonContainer}>
      {!userFinished && !isProcessingFinal && savedDrawingsCount > 0 && (
        <button className={styles.button} onClick={onFinishEarly}>
          Finish Analysis
          <span className={styles.countBadge}>{savedDrawingsCount}</span>
        </button>
      )}

      {!userFinished && !isProcessingFinal && savedDrawingsCount < 15 && (
        <button className={styles.button} onClick={onSaveAndAnalyze}>
          Save
        </button>
      )}
    </div>
  );
}
