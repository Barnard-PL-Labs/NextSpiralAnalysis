"use client";

import styles from "@/styles/Canvas.module.css"; 

export default function Buttons({sendData}) {
    const analyzeDrawing = async () => {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Analyze button clicked!" }),
        });

        const data = await response.json();
        alert(`Analysis Result: ${data.message}`);
    };

    return (
        <div className={styles.buttonContainer}>
            <button className={styles.button} onClick={() => window.location.reload()}>Clear</button>
            <button className={styles.button} onClick={sendData}>Analyze</button>
        </div>
    );
}
