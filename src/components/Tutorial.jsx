"use client";
import { useState, useEffect } from "react";
import styles from "@/styles/Tutorial.module.css";

const Tutorial = ({ onClose, forceShow = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Tutorial pages content
  const tutorialPages = [
    {
      content:
        "Spiral analysis works best with a stylus on a tablet. Position your drawing tool at the center of the cross and get ready to draw!",
      buttonText: "Continue",
    },
    {
      content:
        "Draw at least 3-4 complete revolutions for optimal analysis. Try drawing in a slow and continuous motion to avoid trouble.",
      buttonText: "Continue",
    },
    {
      content:
        "Save up to 15 spirals for analysis and finish your analysis when you're ready to see your results!",
      buttonText: "Get Started",
    },
  ];

  useEffect(() => {
    if (forceShow) {
      // If forceShow is true, show tutorial immediately
      setIsVisible(true);
      return;
    }

    // Check if user has already skipped the tutorial
    const hasSkippedTutorial = localStorage.getItem("tutorialSkipped");

    if (!hasSkippedTutorial) {
      // Preload the tutorial images
      const stylusImage = new Image();
      stylusImage.src = "/Icons/stylus.png";
      
      const endSpiralImage = new Image();
      endSpiralImage.src = "/Icons/endSpiral.png";
      
      // Preload the tutorial video
      const spiralTutVideo = document.createElement("video");
      spiralTutVideo.src = "/Icons/SpiralTut.mov";
      spiralTutVideo.preload = "auto";
      
      // Show tutorial after a short delay to ensure page is loaded
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleSkip = () => {
    // Mark tutorial as skipped in localStorage
    localStorage.setItem("tutorialSkipped", "true");
    setIsVisible(false);
    onClose?.();
  };

  const handleContinue = () => {
    if (currentPage < tutorialPages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      // Tutorial completed
      localStorage.setItem("tutorialSkipped", "true");
      setIsVisible(false);
      onClose?.();
    }
  };

  if (!isVisible) {
    return null;
  }

  const currentPageData = tutorialPages[currentPage];

  return (
    <div className={styles.tutorialOverlay}>
      <div className={styles.tutorialContainer}>
        <button
          className={styles.skipButton}
          onClick={handleSkip}
          aria-label="Skip tutorial"
        >
          Skip
        </button>

        <div className={styles.tutorialContent}>
          <div className={styles.placeholderContent}>
            <div className={styles.whiteSquare}>
              {currentPage === 0 && (
                <img
                  src="/Icons/stylus.png"
                  alt="Tutorial image"
                  className={styles.tutorialImage}
                  loading="eager"
                  fetchPriority="high"
                />
              )}
              {currentPage === 1 && (
                <video
                  src="/Icons/SpiralTut.mov"
                  alt="Spiral tutorial"
                  className={styles.tutorialImage}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}
              {currentPage === 2 && (
                <img
                  src="/Icons/endSpiral.png"
                  alt="End spiral"
                  className={styles.tutorialImage}
                  loading="eager"
                  fetchPriority="high"
                />
              )}
              <div className={styles.cross}></div>
            </div>
            {currentPage === 2 && (
              <div className={styles.fakeButtons}>
                <button className={styles.fakeFinishButton}>
                  Finish Analysis
                  <span className={styles.fakeCountBadge}>1</span>
                </button>
                <button className={styles.fakeSaveButton}>Save</button>
              </div>
            )}
            <div className={styles.paginationDots}>
              {tutorialPages.map((_, index) => (
                <div
                  key={index}
                  className={`${styles.dot} ${
                    index === currentPage ? styles.activeDot : ""
                  }`}
                />
              ))}
            </div>
            <p>{currentPageData.content}</p>
          </div>
        </div>

        <button
          className={styles.continueButton}
          onClick={handleContinue}
          aria-label={currentPageData.buttonText}
        >
          {currentPageData.buttonText}
        </button>
      </div>
    </div>
  );
};

export default Tutorial;
