"use client";

import Head from "next/head";
import Link from "next/link";
import Header from "../components/Header";
import { useResearcherMode } from "@/lib/researcherModeContext";

export default function Home() {
  const { researcherMode } = useResearcherMode();

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/x-icon" href="/Icons/generated-icon-removebg.png" />
        <title>Spiral Analysis</title>
      </Head>

      <Header />

      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          paddingTop: "75px",
          paddingBottom: "40px",
          textAlign: "center",
          background: "var(--color-bg)",
        }}
      >
        <div
          style={{
            maxWidth: "650px",
            width: "90%",
            padding: "40px 20px",
          }}
        >
          {researcherMode ? (
            <>
              <h1
                style={{
                  fontSize: "3rem",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  marginBottom: "20px",
                }}
              >
                Spiral Analysis Tool
              </h1>
              <p
                style={{
                  fontSize: "18px",
                  color: "var(--color-text-secondary)",
                  marginBottom: "40px",
                  lineHeight: 1.6,
                }}
              >
                Medical Technology
              </p>
              <Link href="/machine">
                <button className="indexButton">GET STARTED</button>
              </Link>
            </>
          ) : (
            <>
              <h1
                style={{
                  fontSize: "3rem",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  marginBottom: "20px",
                  lineHeight: 1.2,
                }}
              >
                Analyze Your Motor Skills <br />
                <span style={{ color: "var(--color-accent)" }}>with Precision</span>
              </h1>
              <p
                style={{
                  fontSize: "16px",
                  color: "var(--color-text-secondary)",
                  marginBottom: "40px",
                  lineHeight: 1.7,
                }}
              >
                Your movements reveal a lot about motor control. With Spiral Analysis, a simple
                spiral drawing on your tablet can measure smoothness, speed, and pressure, helping
                you track neuromotor function. Whether you&apos;re a researcher, a medical
                professional, or just curious, this non-invasive tool makes it easy to gain insights
                into hand stability.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/machine">
                  <button className="indexButton">GET STARTED</button>
                </Link>
                <Link href="/instruction">
                  <button
                    className="indexButton"
                    style={{
                      background: "transparent",
                      border: "2px solid var(--color-accent)",
                      color: "var(--color-accent)",
                    }}
                  >
                    HOW IT WORKS →
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
