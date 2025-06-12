"use client";

import styles from "../styles/Info.module.css";
import Link from "next/link";
import { useState } from "react";

const TeamMember = ({ name, bio, position, uni, isDirector, websiteUrl }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
  <div className={`${styles.teamMember} ${isDirector ? styles.director : ""}`}>
      {websiteUrl ? (
        <div 
          className={styles.linkContainer}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Link href={websiteUrl} target="_blank" rel="noopener noreferrer">
            <h3 style={{ cursor: 'pointer', textDecoration: 'underline' }}>{name}</h3>
          </Link>
          {showTooltip && (
            <div className={styles.tooltip}>
              {websiteUrl}
            </div>
          )}
        </div>
      ) : (
    <h3>{name}</h3>
      )}
    <p>{bio}</p>
    <p>{position}</p>
    <p>{uni}</p>
  </div>
);
};

export default TeamMember;
