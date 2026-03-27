"use client";
import Header from "../../components/Header";
import styles from "../../styles/Info.module.css";
import TeamMember from "../../components/Team";
import GridSection from "../../components/GridSection";

const teamMembers = [
  {
    name: "Seth L. Pullman, MD",
    bio: "Clinical Motor Physiology Laboratory",
    position: "Director",
    uni: "Columbia University",
    isDirector: true,
    websiteUrl: "https://www.neurology.columbia.edu/profile/seth-l-pullman-md",
  },
  {
    name: "Mark Santolucito, PhD",
    bio: "Barnard Programming Languages Lab",
    position: "Director",
    uni: "Barnard College",
    isDirector: true,
    websiteUrl: "https://www.marksantolucito.com/index.html",
  },
  { name: "Yiping Wang, MS" },
  { name: "Qiping Yu, PhD" },
  { name: "Jianqin Qu, MS" },
  { name: "Mehmet Can Isik, MEng" },
  { name: "Alicia Floyd, MD" },
  { name: "Annie Hsu, MD" },
  { name: "Audrey Rakovich Seville, BA" },
  { name: "Jonathan A. Sisti, MD" },
];

export default function TeamPage() {
  return (
    <>
      <Header showVideo={false} />
      <div className={styles.teamPage}>
        <div className={styles.pageInner}>
          <h1 className={styles.pageTitle}>About</h1>
          <div className={styles.twoCol}>
            <div className={styles.teamSection}>
              <p className={styles.sectionLabel}>Team</p>
              <div className={styles.directorsRow}>
                {teamMembers
                  .filter((m) => m.isDirector)
                  .map((director, i) => (
                    <TeamMember key={i} {...director} />
                  ))}
              </div>
              <p className={styles.alumniTitle}>Alumni</p>
              <div className={styles.membersRow}>
                {teamMembers
                  .filter((m) => !m.isDirector)
                  .map((member, i) => (
                    <TeamMember key={i} {...member} />
                  ))}
              </div>
            </div>
            <div className={styles.researchSection}>
              <GridSection />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
