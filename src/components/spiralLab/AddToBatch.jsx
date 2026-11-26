"use client";
// "Add this spiral to the batch", for the Simple and Detailed views: pick how
// many copies, add, keep adjusting and add more, then send them all from the
// Batch tab.
import { useState } from "react";
import styles from "@/styles/SpiralLab.module.css";
import { MAX_COPIES } from "@/lib/spiralBatch";

export default function AddToBatch({ settings, batch, disabled, onOpenBatch }) {
  const [copies, setCopies] = useState(1);
  const [note, setNote] = useState(null);

  const add = () => {
    const added = batch.add(settings, copies);
    setNote(added ? `Added ${added}.` : "The batch is full.");
  };

  return (
    <div className={styles.addToBatch}>
      <span className={styles.label}>Add to batch</span>
      <span className={styles.numberWrap}>
        ×
        <input
          className={styles.number}
          type="number"
          min={1}
          max={MAX_COPIES}
          value={copies}
          aria-label="Copies to add"
          onChange={(e) => setCopies(Math.max(1, Math.min(MAX_COPIES, Math.round(Number(e.target.value)) || 1)))}
        />
      </span>
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={disabled} onClick={add}>
        Add {copies === 1 ? "this spiral" : `${copies} copies`}
      </button>
      <span className={styles.status}>
        {note && `${note} `}
        Batch: {batch.total} spiral{batch.total === 1 ? "" : "s"}
      </span>
      {batch.total > 0 && (
        <button type="button" className={styles.linkButton} onClick={onOpenBatch}>
          Open batch →
        </button>
      )}
    </div>
  );
}
