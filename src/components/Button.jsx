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
  isLoadingResults = false,
}) {
  const handleClear = () => {
    clearDrawing();
    window.location.reload();
  };

  return (
    <div className={styles.buttonContainer}>
      {!isProcessingFinal && savedResultsCount < 5 && (
        <button className={styles.button} onClick={clearDrawing}>
          Clear
        </button>
      )}

      {savedResultsCount < 5 && savedDrawingsCount < 5 ? (
        <button className={styles.button} onClick={onSaveAndAnalyze}>
          Save ({savedDrawingsCount + 1}/5)
        </button>
      ) : (
        <button 
          className={styles.button} 
          onClick={sendData}
          data-loading={isLoadingResults}
          disabled={isLoadingResults}
        >
          <span className={styles.buttonText}>View Results</span>
          {isLoadingResults && <span className={styles.buttonSpinner} />}
        </button>
      )}
    </div>
  );
}

