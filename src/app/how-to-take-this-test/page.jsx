"use client";

import Link from "next/link";
import Header from "@/components/Header";
import TestSteps from "@/components/TestSteps";
import styles from "@/styles/Directions.module.css";

// A shortcut to the instructions, so they can be reached straight from the nav
// without going into Learn More and scrolling. Same steps, same component.
export default function HowToTakeThisTestPage() {
  return (
    <>
      <Header showVideo={false} />
      <div className={styles.mainContainer}>
        <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 56 }}>
          <h1 className={styles.sectionH2} style={{ fontSize: 32 }}>
            How to Take This Test
          </h1>

          <TestSteps />

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
            <Link href="/machine" style={{ textDecoration: "none" }}>
              <button
                style={{
                  background: "#1E40AF",
                  border: "none",
                  borderRadius: 9,
                  padding: "11px 22px",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: "#fff",
                  boxShadow: "0 4px 14px -4px rgba(30,64,175,0.5)",
                }}
              >
                Start Test
              </button>
            </Link>

            <Link
              href="/instruction"
              style={{
                fontFamily: "'Public Sans', sans-serif",
                fontSize: 14.5,
                color: "#1E40AF",
                textDecoration: "none",
              }}
            >
              Learn more about Spiral Analysis →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
