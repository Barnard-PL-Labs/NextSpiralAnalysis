"use client";

import Header from "@/components/Header";
import styles from "@/styles/Directions.module.css";
import { FaStarHalf, FaStar } from "react-icons/fa";
export default function DirectionsPage() {
  return (
    <>
      <Header showVideo={true} />

      <div className={styles.mainContainer}>
        <div className={styles.directionsContainer}>
          <h2 className={styles.directionsHeader}>
            Spiral Analysis Information
          </h2>

          {/* What is Spiral Analysis Section */}
          <section className={styles.section}>
            <div className={styles.analysisIntro}>
              <div className={styles.textBlock}>
                <h3 className={styles.subHeader}>What is Spiral Analysis?</h3>
                <p className={styles.intro}>
                  Spiral Analysis is a non-invasive system of quantifying motor
                  function based on kinematic and physiologic features derived
                  from handwritten spirals. Spiral Analysis uses a digitizing
                  tablet and writing pen to record position, force and time
                  measurements.
                </p>

                <p className={styles.intro}>
                  Spiral Analysis is based on “unraveling” the two-dimensional
                  drawn spiral picture into a data series that captures its
                  original kinematic information and allows for further
                  computational manipulations and clinical correlations. Spiral
                  data are collected in the X, Y and pressure axes providing
                  virtual “tri-axial” recordings. This effectively extends
                  spiral drawing - a standard clinical test - into an objective
                  and accurate measure of motor control. Mathematical
                  formulations are used to create into indices that quantify the
                  kinematic parameters, and assess many spiral features
                  including overall degree of severity, shape, drawing speed,
                  tightness of loops, irregularity and tremor. Over 70 indices
                  are created, and multiple spirals can be averaged.
                </p>
                <p className={styles.intro}>
                  Spiral Analysis provides greater accuracy and objectivity than
                  the clinical exam alone. It has already been used to study the
                  details of normal motor control, to quantify normal and
                  abnormal motor development and analyze movement disorders such
                  as Parkinson’s disease, tremors, dystonia, ataxia and
                  functional movements. Because of its precision and
                  reproducibility, Spiral Analysis is also useful in quantifying
                  changes before and after medical or surgical treatments.
                </p>
              </div>

              <div className={styles.keyPoints}>
                <h4>
                  {" "}
                  <strong> Why Use Spiral Analysis?</strong>{" "}
                </h4>
                <ul>
                  <li> - Non-invasive and easy to administer</li>
                  <li> - Provides real-time feedback</li>
                  <li> - Tracks motor function over time</li>
                  <li> - Highly sensitive to neuromotor changes</li>
                  <li> - Useful for research and clinical assessments</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How to Use Section (Moved Up) */}
          <section className={styles.section}>
            <h3 className={styles.subHeader}>How to Use This Tool</h3>
            <ul className={styles.directionsList}>
              <li>
                <FaStar />
                Draw at least{" "}
                <strong className={styles.highlight}>
                  3-4 complete revolutions
                </strong>
                .
              </li>
              <li>
                Draw a spiral on the provided canvas using your mouse or
                touchscreen.
              </li>
              <li>
                Try to make the spiral as round and evenly spaced as possible.
              </li>
              <li>Try to maintain a consistent drawing speed and pressure.</li>
              <li>
                <FaStar />
                For best results, try to{" "}
                <strong className={styles.highlight}>
                  draw in a single, continuous motion
                </strong>
                .
              </li>
              <li>Click Save to proceed on to the next drawing.</li>
              <li>
                Click the "Finish Analysis" button to process your spiral.
              </li>
              <li>
                Review the results and graphs provided for insights into your
                upper limb motor control.
              </li>
              <li>
                Compare your results over time to track changes in your motor
                function!
              </li>
            </ul>
            {/* <p className={styles.note}>
                            For best results, try to draw in a single, continuous motion without interruptions.
                        </p> */}
          </section>

          {/* Key Metrics Section (Moved Down) */}
          <section className={styles.section}>
            <h3 className={styles.subHeader}>Key Metrics in Spiral Analysis</h3>
            <ul className={styles.metricsList}>
              <li>
                <strong>DOS (Degree of Severity):</strong> A comprehensive
                measure of overall spiral drawing performance. It is a unitless,
                continuous measure correlating with a five-point rating scale (0
                to 4) where 0 to 0.99 is normal, 1 to 1.99 mild, 2 to 2.99
                moderate, and 3.0 to 4.0 severely abnormal.
              </li>
              <li>
                <strong>Smoothness:</strong> A unitless measure of spiral
                continuity and variation from the ideal spiral shape. Normal is
                less than -4.
              </li>
              <li>
                <strong>Tightness:</strong> Measures how closely the spiral
                loops are drawn to each other, normalized to 5 loops in a 10 x
                10 cm drawing box. Normal is about 1.
              </li>
              <li>
                <strong>Pressure:</strong> Analyzes the forces applied to the
                pen while drawing. It can reveal otherwise hidden tremors.
              </li>
              <li>
                <strong>Speed:</strong> Measures the drawing speed (cm/sec) of
                the spiral. It is calculated as the distance between consecutive
                x, y points, averaged over the length of the spiral, divided by
                the sampling time. Normal is 15 - 25 cm/sec.
              </li>
              <li>
                <strong>Tremor:</strong> The detectable tremor in the x, y, or
                pressure axes above the noise baseline greater than 1 Hz. Normal
                is less than 2.
              </li>
              <li>
                <strong>Frequency Analysis:</strong> Examines the rhythmic
                components and axes of tremor of the spiral drawing. It can help
                identify specific types of tremor.
              </li>
              <li>
                <strong>Width Variabiity:</strong> This measures unsteadiness
                and clumsiness of drawing. It is a unitless correlate of drawing
                irregularity and computed as the loop-to-loop variability
                sampled every 5°. Normal is less than 0.250.
              </li>
            </ul>
            {/* <p className={styles.note}>
                            For a full listing of the metrics provided by Spiral Analysis, please see the API documentation.
                        </p> */}
          </section>

          {/* Disclaimer Section */}
          <section className={styles.section}>
            <p className={styles.warning}>
              ⚠ Note: This tool is for educational purposes only. For medical
              concerns, always consult with a healthcare professional.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
