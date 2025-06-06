"use client";
//Eventhough this page is called button in general but it is only used for the machine page
import styles from "@/styles/Canvas.module.css";

export default function Buttons({
  sendData,
  clearDrawing,
  savedDrawingsCount = 0,
  savedResultsCount = 0,
  isProcessingFinal = false,
  onSaveAndAnalyze,
}) {
  const handleClear = () => {
    clearDrawing();
    window.location.reload();
  };

  return (
    <div className={styles.buttonContainer}>
      {!isProcessingFinal && (
        <button className={styles.button} onClick={clearDrawing}>
          Clear
        </button>
      )}

      {isProcessingFinal ? (
        <button className={styles.button} disabled>
          Processing DOS Score...
        </button>
      ) : savedResultsCount < 5 && savedDrawingsCount < 5 ? (
        <button className={styles.button} onClick={onSaveAndAnalyze}>
          Save ({savedDrawingsCount + 1}/5)
        </button>
      ) : savedResultsCount >= 5 ? (
        <button className={styles.button} onClick={sendData}>
          View Results
        </button>
      ) : null}
    </div>
  );
}

