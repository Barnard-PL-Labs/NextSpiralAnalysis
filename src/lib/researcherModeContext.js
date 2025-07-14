"use client";

import { createContext, useContext, useState, useEffect } from 'react';

const ResearcherModeContext = createContext();

export function ResearcherModeProvider({ children }) {
  const [researcherMode, setResearcherMode] = useState(false);

  useEffect(() => {
    // Load researcher mode from localStorage on mount
    const savedResearcherMode = localStorage.getItem("researcherMode");
    if (savedResearcherMode !== null) {
      setResearcherMode(savedResearcherMode === "true");
    }
  }, []);

  const toggleResearcherMode = (newValue) => {
    setResearcherMode(newValue);
    localStorage.setItem("researcherMode", newValue.toString());
  };

  return (
    <ResearcherModeContext.Provider value={{ researcherMode, toggleResearcherMode }}>
      {children}
    </ResearcherModeContext.Provider>
  );
}

export function useResearcherMode() {
  const context = useContext(ResearcherModeContext);
  if (context === undefined) {
    throw new Error('useResearcherMode must be used within a ResearcherModeProvider');
  }
  return context;
} 