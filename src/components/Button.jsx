"use client";
//Eventhough this page is called button in general but it is only used for the machine page
import styles from "@/styles/Canvas.module.css";

export default function Buttons({
  sendData,
  clearDrawing,
  savedDrawingsCount = 0,
  savedResultsCount = 0,
  isProcessingFinal = false,
  isAnalysisComplete = false,
  onSaveAndAnalyze,
  isLoadingResults = false,
  onFinishEarly,
  userFinished = false,
}) {
  const handleClear = () => {
    clearDrawing();
    window.location.reload();
  };

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
