"use client";

import Header from "@/components/Header";
import styles from "@/styles/Directions.module.css";
import {FaStarHalf, FaStar} from 'react-icons/fa';
export default function DirectionsPage() {
    return (
        <>
            <Header showVideo={true} />

            <div className={styles.mainContainer}>
                <div className={styles.directionsContainer}>
                    <h2 className={styles.directionsHeader}>Spiral Analysis Information</h2>

                    {/* What is Spiral Analysis Section */}
                    <section className={styles.section}>
                        <div className={styles.analysisIntro}>
                            <div className={styles.textBlock}>
                                <h3 className={styles.subHeader}>What is Spiral Analysis?</h3>
                                <p className={styles.intro}>
                                    Spiral analysis is a sophisticated method used to evaluate upper limb motor control. It involves drawing a spiral on a digitizing tablet or touchscreen device, which captures various parameters such as pressure, speed, and accuracy. This non-invasive technique provides valuable insights into a person's neuromotor function.
                                </p>
                            </div>

                            <div className={styles.keyPoints}>
                                <h4>Why Use Spiral Analysis?</h4>
                                <ul>
                                    <li>Non-invasive and easy to administer</li>
                                    <li>Provides real-time feedback</li>
                                    <li>Tracks motor function over time</li>
                                    <li>Highly sensitive to neuromotor changes</li>
                                    <li>Useful for research and clinical assessments</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* How to Use Section (Moved Up) */}
                    <section className={styles.section}>
                        <h3 className={styles.subHeader}>How to Use This Tool</h3>
                        <ul className={styles.directionsList}>
                            <li><FaStar />Draw at least <strong className={styles.highlight}>3-4 complete revolutions</strong>.</li>
                            <li>Draw a spiral on the provided canvas using your mouse or touchscreen.</li>
                            <li>Try to make the spiral as round and evenly spaced as possible.</li>
                            <li>Try to maintain a consistent drawing speed and pressure.</li>
                            <li><FaStar />For best results, try to <strong className={styles.highlight}>draw in a single, continuous motion</strong>.</li>
                            <li>Click Save to proceed on to the next drawing.</li>
                            <li>Click the "Finish Analysis" button to process your spiral.</li>
                            <li>Review the results and graphs provided for insights into your upper limb motor control.</li>
                            <li>Compare your results over time to track changes in your motor function!</li>
                        </ul>
                        {/* <p className={styles.note}>
                            For best results, try to draw in a single, continuous motion without interruptions.
                        </p> */}
                    </section>

                    {/* Key Metrics Section (Moved Down) */}
                    <section className={styles.section}>
                        <h3 className={styles.subHeader}>Key Metrics in Spiral Analysis</h3>
                        <ul className={styles.metricsList}>
                            <li><strong>DOS (Degree of Severity):</strong> A comprehensive measure of overall spiral drawing performance, indicating the severity of motor impairment.</li>
                            <li><strong>Smoothness:</strong> Evaluates the continuity and fluidity of the drawn spiral, reflecting the steadiness of hand movements.</li>
                            <li><strong>Tightness:</strong> Measures how closely the spiral turns are drawn to each other, indicating control over fine motor movements.</li>
                            <li><strong>Pressure:</strong> Analyzes the force applied while drawing the spiral, which can reveal tremors or muscle weakness.</li>
                            <li><strong>Speed:</strong> Measures the velocity of drawing at different points in the spiral, providing insights into motor planning and execution.</li>
                            <li><strong>Frequency Analysis:</strong> Examines the rhythmic components of the drawing, which can help identify specific types of tremors.</li>
                        </ul>
                        {/* <p className={styles.note}>
                            For a full listing of the metrics provided by Spiral Analysis, please see the API documentation.
                        </p> */}
                    </section>

                    {/* Disclaimer Section */}
                    <section className={styles.section}>
                        <p className={styles.warning}>
                            ⚠ Note: This tool is for educational purposes only. For medical concerns, always consult with a healthcare professional.
                        </p>
                    </section>
                </div>
            </div>
        </>
    );
}
