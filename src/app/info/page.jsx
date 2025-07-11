"use client";
import Header from "../../components/Header";
import styles from "../../styles/Info.module.css";
import TeamMember from "../../components/Team";
import GridSection from "../../components/GridSection";
import { useContext } from "react";
import { ResponsiveContext } from "@/components/ClientLayout";

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
  {
    name: "Yiping Wang, MS",
    position: "",
    bio: "",
    uni: "",
  },
  {
    name: "Qiping Yu, PhD",
    bio: "",
    uni: "",
  },
  {
    name: "Jianqin Qu, MS",
    bio: "",
    uni: "",
  },
  {
    name: "Mehmet Can Isik, MEng",
    uni: "",
  },
  {
    name: "Alicia Floyd, MD",
    bio: "",
    uni: "",
  },
    {
    name: "Annie Hsu, MD",
    bio: "",
    uni: "",
  },
    {
    name: "Audrey Rakovich Seville, BA",
    bio: "",
    uni: "",
  },
    {
    name: "Jonathan A. Sisti, MD",
    bio: "",
    uni: "",
  },
];

export default function TeamPage() {
  const { isMobile } = useContext(ResponsiveContext);

  return (
    <>
      <div className={styles.teamPage}>
        <Header showVideo={true} />
        <h1
          id={styles.title}
          style={{
            fontSize: "55px",
            marginTop: "20px",
            marginBottom: "-10px",
          }}
        >
          About 
        </h1>
        <div className={`${styles.teamSection} `}>
          <div className={styles.directorsRow}>
            {teamMembers
              .filter((member) => member.isDirector)
              .map((director, index) => (
                <TeamMember key={index} {...director} />
              ))}
          </div>
          <h2 className={styles.alumniTitle}>Alumni</h2>
          <div className={styles.membersRow}>
            {teamMembers
              .filter((member) => !member.isDirector)
              .map((member, index) => (
                <TeamMember key={index} {...member} />
              ))}
          </div>
        </div>
        <div className={`${styles.gridSectionWrapper}`}>
          <GridSection />
        </div>
      </div>
    </>
  );
}
