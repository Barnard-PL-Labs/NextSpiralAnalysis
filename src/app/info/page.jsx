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

const alumni = [
  "Yiping Wang, MS",
  "Qiping Yu, PhD",
  "Jianqin Qu, MS",
  "Mehmet Can Isik, MEng",
  "Alicia Floyd, MD",
  "Annie Hsu, MD",
  "Audrey Rakovich Seville, BA",
  "Jonathan A. Sisti, MD",
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

const getInitials = (name) =>
  name
    .split(",")[0]
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

export default function TeamPage() {
  return (
    <>
      <Header showVideo={false} />
      <main className={styles.aboutPage}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>About</p>
              <h1>Making motor function measurable.</h1>
              <p className={styles.heroText}>
                Spiral Analysis began with a simple clinical observation: a drawn
                spiral holds far more information than the eye can read. We built
                the tools to extract it.
              </p>
            </div>
            <div className={styles.spiralMark} aria-hidden="true">
              <svg viewBox="0 0 520 520" role="img">
                <path
                  d="M258 260c-14 0-23-12-19-25 5-18 31-25 52-8 27 22 19 68-21 89-55 29-126-9-139-75-17-84 52-161 139-159 107 3 186 102 158 207-34 126-189 187-300 107-128-92-132-286-6-386 147-117 366-38 409 145"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.2"
                />
              </svg>
            </div>
          </div>
        </section>

        <div className={styles.content}>
          <section className={styles.section}>
            <p className={styles.eyebrow}>Faculty</p>
            <h2>Principal investigators.</h2>
            <div className={styles.piGrid}>
              {principalInvestigators.map((person) => (
                <Link
                  key={person.name}
                  href={person.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.piCard}
                >
                  <span className={styles.avatar}>{person.initials}</span>
                  <span>
                    <strong>{person.name}</strong>
                    <span>{person.role}</span>
                    <small>{person.institution}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>Alumni</p>
            <h2>Researchers who built the method.</h2>
            <div className={styles.alumniGrid}>
              {alumni.map((person) => (
                <div key={person} className={styles.alumniCard}>
                  <strong>{person}</strong>
                  <span>{getInitials(person)} - Spiral Analysis contributor</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>Publications</p>
            <h2>Selected articles.</h2>
            <div className={styles.publicationGrid}>
              {publications.map((article) => (
                <Link
                  key={article.title}
                  href={article.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.publicationCard}
                >
                  <span className={styles.articleMeta}>
                    <span>Journal Article</span>
                    <small>{article.year}</small>
                  </span>
                  <strong>{article.title}</strong>
                  <em>{article.meta}</em>
                  <span className={styles.readLink}>Read article -&gt;</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div>
            <span className={styles.footerLogo} aria-hidden="true">S</span>
            <span>Spiral Analysis</span>
          </div>
          <p>&copy; 2026 - Non-invasive neuromotor assessment</p>
        </footer>
      </main>
    </>
  );
}
