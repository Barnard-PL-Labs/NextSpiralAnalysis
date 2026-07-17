"use client";

import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";
import { useResearcherMode } from "@/lib/researcherModeContext";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

function generateSpiral({ turns = 5, b = 15, jitter = 0, steps = 720 } = {}) {
  const maxT = turns * 2 * Math.PI;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (maxT * i) / steps;
    let r = (b * t) / (2 * Math.PI);
    if (jitter) {
      const n = Math.sin(t * 11) * 0.55 + Math.sin(t * 27 + 1.3) * 0.3 + Math.sin(t * 5.5) * 0.2;
      r += n * jitter;
    }
    d += (i === 0 ? "M" : "L") + (r * Math.cos(t)).toFixed(2) + " " + (r * Math.sin(t)).toFixed(2) + " ";
  }
  return d.trim();
}

const heroTexturePath  = generateSpiral({ turns: 6.5, b: 14, steps: 900 });
const heroSpiralPath   = generateSpiral({ turns: 4.5, b: 17 });
const jitteredTracePath = generateSpiral({ turns: 4, b: 19, jitter: 3 });

const palette = {
  "--ink": "#0B1B2B", "--ink-soft": "#37485A", "--muted": "#6A7A8A",
  "--line": "#E4E9EE", "--line-soft": "#EFF2F5", "--paper": "#FFFFFF",
  "--bg": "#F7F9FB", "--bg-2": "#EEF2F6",
  "--accent": "#1E40AF", "--accent-ink": "#1E40AF", "--accent-soft": "#EFF6FF",
  "--teal": "#13917F",
};

const steps = [
  { n: "01", title: "Draw the spiral", body: "An Archimedean spiral on a tablet — no wires, no specialist hardware. Takes under two minutes." },
  { n: "02", title: "We analyze the trace", body: "Every point (x, y, pressure, time) is decomposed into smoothness, speed, pressure, and consistency indices." },
  { n: "03", title: "Track over time", body: "Saved as an objective baseline so subtle change is visible session over session." },
];

const conditionTags = ["Parkinson's disease", "Essential tremor", "Dystonia"];

export default function Home() {
  const { researcherMode } = useResearcherMode();
  const evidenceRef = useRef(null);
  const evidenceInView = useInView(evidenceRef, { once: true, margin: "-80px" });

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/x-icon" href="/Icons/generated-icon-removebg.png" />
        <title>Spiral Analysis</title>
      </Head>

      <Header />

      <div style={{ ...palette, fontFamily: "'Public Sans', system-ui, sans-serif", color: "var(--ink)", background: "var(--bg)", minHeight: "100vh", WebkitFontSmoothing: "antialiased", paddingTop: "64px" }}>
        <style>{`@keyframes draw{from{stroke-dashoffset:1;}to{stroke-dashoffset:0;}}`}</style>

        {/* ── HERO ── */}
        <div style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
          <svg viewBox="-100 -100 200 200" width="760" height="760"
            style={{ position: "absolute", right: "-180px", top: "50%", transform: "translateY(-50%)", opacity: 0.07, pointerEvents: "none" }}>
            <path d={heroTexturePath} stroke="var(--ink)" strokeWidth="0.7" fill="none" />
          </svg>

          <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "104px 32px 96px", position: "relative" }}>
            <div style={{ maxWidth: "660px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "9px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", letterSpacing: "0.12em", color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "7px 13px", borderRadius: "100px", marginBottom: "26px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--teal)", flexShrink: 0 }} />
                SPIRAL ANALYSIS
              </div>

              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: "62px", lineHeight: 1.02, letterSpacing: "-0.03em", margin: "0 0 22px", color: "var(--ink)" }}>
                {researcherMode
                  ? "Spiral Analysis Tool"
                  : "Drawing a spiral helps us track your tremor."}
              </h1>

              <p style={{ fontSize: "19px", lineHeight: 1.6, color: "var(--ink-soft)", margin: "0 0 34px", maxWidth: "560px" }}>
                {researcherMode
                  ? "Medical technology for neuromotor assessment."
                  : "Spiral Analysis turns a spiral drawn on any tablet into objective measures of smoothness, speed, and pressure. Whether you're a researcher, a medical professional, or just curious, this non-invasive tool makes it easy to gain insights into hand stability."}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <Link href="/"
                  style={{ textDecoration: "none", color: "#fff", background: "var(--accent)", fontSize: "15.5px", fontWeight: 600, padding: "15px 26px", borderRadius: "11px", boxShadow: "0 12px 28px -12px rgba(30,64,175,0.55)", transition: "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease", display: "inline-block" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1634A0"; e.currentTarget.style.boxShadow = "0 16px 36px -10px rgba(30,64,175,0.7)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.boxShadow = "0 12px 28px -12px rgba(30,64,175,0.55)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  onMouseDown={e => { e.currentTarget.style.transform = "translateY(0) scale(0.97)"; e.currentTarget.style.boxShadow = "0 6px 16px -8px rgba(30,64,175,0.4)"; }}
                  onMouseUp={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1)"; e.currentTarget.style.boxShadow = "0 16px 36px -10px rgba(30,64,175,0.7)"; }}
                >
                  Start a drawing
                </Link>
                <Link href="#how"
                  style={{ textDecoration: "none", color: "var(--ink)", background: "transparent", border: "1px solid var(--line)", fontSize: "15.5px", fontWeight: 600, padding: "15px 24px", borderRadius: "11px", transition: "border-color 0.15s ease, color 0.15s ease", display: "inline-block" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent-ink)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink)"; }}
                >
                  How it works →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div id="how" style={{ background: "var(--ink)", color: "#fff", padding: "96px 32px" }}>
          <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", color: "#8FB4EE", marginBottom: "14px" }}>HOW IT WORKS</div>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: "42px", lineHeight: 1.06, letterSpacing: "-0.025em", margin: "0 0 52px", maxWidth: "520px" }}>
              From pen stroke to longitudinal record in three steps.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "18px", overflow: "hidden" }}>
              {steps.map((step, i) => (
                <div key={step.n} style={{ padding: "38px 32px", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#8FB4EE", marginBottom: "22px" }}>{step.n}</div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: "22px", marginBottom: "10px" }}>{step.title}</div>
                  <div style={{ fontSize: "14.5px", lineHeight: 1.6, color: "#B9C6D4" }}>{step.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── EVIDENCE ── */}
        <div id="evidence" style={{ background: "var(--bg)", color: "var(--ink)", borderTop: "1px solid var(--line)" }}>
          <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "92px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", color: "var(--accent)", marginBottom: "16px" }}>GROUNDED IN RESEARCH</div>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: "40px", lineHeight: 1.08, letterSpacing: "-0.025em", margin: "0 0 20px", color: "var(--ink)" }}>
                Built on a clinically validated method.
              </h2>
              <p style={{ fontSize: "16px", lineHeight: 1.65, color: "var(--ink-soft)", margin: "0 0 26px", maxWidth: "480px" }}>
                Digitized spiral drawing is an established, non-invasive technique for characterizing upper-limb motor performance and detecting subtle change — studied across movement disorders for over two decades.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {conditionTags.map(tag => (
                  <span key={tag} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "var(--ink)", border: "1px solid var(--line)", padding: "8px 14px", borderRadius: "100px" }}>{tag}</span>
                ))}
              </div>
            </div>

            <div ref={evidenceRef} style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="-100 -100 200 200" width="340" height="340">
                <defs>
                  <clipPath id="spiral-reveal">
                    <motion.circle
                      cx="0" cy="0"
                      initial={{ r: 0 }}
                      animate={evidenceInView ? { r: 105 } : { r: 0 }}
                      transition={{ duration: 5, ease: "linear" }}
                    />
                  </clipPath>
                </defs>
                {/* Faint template */}
                <path d={heroSpiralPath} stroke="var(--line)" strokeWidth="0.8" fill="none" />
                {/* Accent trace — revealed by expanding circle from center out */}
                <g clipPath="url(#spiral-reveal)">
                  <path d={jitteredTracePath} stroke="#1E40AF" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <circle cx="0" cy="0" r="2.6" fill="#13917F" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
