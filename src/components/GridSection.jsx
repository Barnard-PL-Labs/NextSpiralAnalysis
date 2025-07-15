"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "../styles/Info.module.css";

const GridSection = () => {
  const gridItems = [
    {
      title:
        "Spiral Analysis: A New Technique for Measuring Tremor With a Digitizing Tablet",
      imageUrl: "/Icons/medSpiral.jpg",
      linkUrl:
        "https://movementdisorders.onlinelibrary.wiley.com/doi/abs/10.1002/mds.870131315",
    },
    {
      title:
        "Validation of digital spiral analysis as outcome parameter for clinical trials in essential tremor",
      imageUrl: "/Icons/e-tremor.png",
      linkUrl:
        "https://movementdisorders.onlinelibrary.wiley.com/doi/full/10.1002/mds.23808",
    },
  ];

  return (
    <div>
      <h2 className={styles.newsTitle}>Research</h2>
      <div className={styles.gridContainer}>
        {gridItems.map((item, index) => (
          <div key={index} className={styles.gridItem}>
            <div className={styles.gridImageContainer}>
              <Image
                src={item.imageUrl}
                alt={item.title}
                width={400}
                height={300}
                className={styles.gridImage}
              />
            </div>
            <div className={styles.gridContent}>
              {item.linkUrl ? (
                <Link
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h3
                    className={styles.gridTitle}
                    style={{ cursor: "pointer" }}
                  >
                    {item.title}
                  </h3>
                </Link>
              ) : (
                <h3 className={styles.gridTitle}>{item.title}</h3>
              )}
              <p className={styles.gridDescription}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GridSection;
