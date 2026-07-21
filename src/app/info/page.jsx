"use client";

import Link from "next/link";
import Header from "../../components/Header";
import styles from "../../styles/Info.module.css";

const principalInvestigators = [
  {
    initials: "SP",
    name: "Seth L. Pullman, MD",
    role: "Director, Clinical Motor Physiology Laboratory",
    institution: "Columbia University",
    websiteUrl: "https://www.neurology.columbia.edu/profile/seth-l-pullman-md",
  },
  {
    initials: "MS",
    name: "Mark Santolucito, PhD",
    role: "Director, Barnard Programming Languages Lab",
    institution: "Barnard College",
    websiteUrl: "https://www.marksantolucito.com/index.html",
  },
];

const developer = [
  { name: "Seth L. Pullman",         degree: "MD"   },
  { name: "Mark Santolucito",        degree: "PhD"  },
  { name: "Yiping Wang",             degree: "MS"   },
  { name: "Qiping Yu",               degree: "PhD"  },
  { name: "Jianqin Qu",              degree: "MS"   },
  { name: "Mehmet Can Isik",         degree: "MEng" },
  { name: "Alicia Floyd",            degree: "MD"   },
  { name: "Annie Hsu",               degree: "MD"   },
  { name: "Audrey Rakovich Seville", degree: "BA"   },
  { name: "Jonathan A. Sisti",       degree: "MD"   },
  { name: "Alisha Chang",            degree: "BA"   },
  { name: "Eileen Zalavarria",       degree: "BA"   },
];

const publications = [
  {
    title: "Spiral Analysis: A New Technique for Measuring Tremor With a Digitizing Tablet",
    meta: "Movement Disorders",
    year: "1998",
    linkUrl: "https://movementdisorders.onlinelibrary.wiley.com/doi/abs/10.1002/mds.870131315",
  },
  {
    title: "Validation of digital spiral analysis as outcome parameter for clinical trials in essential tremor",
    meta: "Movement Disorders",
    year: "2011",
    linkUrl: "https://movementdisorders.onlinelibrary.wiley.com/doi/full/10.1002/mds.23808",
  },
];

export default function TeamPage() {
  return (
    <>
      <Header showVideo={false} />
      <main className={styles.aboutPage}>
        {/* Hero */}
        <div className={styles.content} style={{ paddingTop: "110px", paddingBottom: "60px" }}>
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600, fontSize: "56px", lineHeight: 1.04, letterSpacing: "-0.03em", margin: "0 0 22px", color: "#0B1B2B" }}>
            {"About Us"}
          </h1>
          <p style={{ fontFamily: "'Public Sans', sans-serif", fontSize: "18.5px", lineHeight: 1.75, color: "#37485A", maxWidth: 600, margin: 0, textWrap: "pretty" }}>
            Originally designed in the Clinical Motor Physiology Laboratory, Department of Neurology, Columbia University Irving Medical Center.
          </p>
        </div>

        {/* Full-width divider */}
        <hr style={{ margin: 0, border: "none", borderTop: "1px solid #E4E9EE" }} />

        {/* Developers */}
        <div className={styles.content} style={{ paddingTop: "64px", paddingBottom: "100px" }}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1E40AF", margin: "0 0 32px" }}>
            Developers
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", columnGap: 80 }}>
            {developer.map(({ name, degree }) => (
              <div key={name} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
                <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: 16, letterSpacing: "-0.005em", color: "#0B1B2B" }}>
                  {name}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400, fontSize: 11, letterSpacing: "0.06em", color: "#9AA7B4" }}>
                  {degree}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
