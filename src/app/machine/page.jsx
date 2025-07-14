"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css";
import MiniSpiralHistory from "@/components/MiniSpiralHistory";
import Header from "@/components/Header";
import Tutorial from "@/components/Tutorial";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import backgroundStyles from "@/styles/Background.module.css";
import { FaHandPaper } from "react-icons/fa";

export default function MachinePage() {
  const canvasRef = useRef();
  const [savedDrawings, setSavedDrawings] = useState([]);
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedHand, setSelectedHand] = useState(null); // 'dominant' or 'non-dominant'
  const [showDemographics, setShowDemographics] = useState(false);
  const [demographics, setDemographics] = useState({
    name: '',
    age: '',
    sex: ''
  });
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Reset hand selection every time user navigates to this page
    setSelectedHand(null);
    localStorage.removeItem('selectedHand');

    const originalFrom = supabase.from;
    
    supabase.from = function(table) {
      const queryBuilder = originalFrom.call(this, table);
      
      if (table === 'api_results') {
        console.log('🔍 Supabase query to api_results table initiated');
        
        const originalEq = queryBuilder.eq;
        queryBuilder.eq = function(column, value) {
          console.log(`📝 Query: ${table}.${column} = ${value}`);
          
          if (column === 'drawing_id' && typeof value === 'string' && value.includes('anon_')) {
            console.error('🚨🚨🚨 FOUND THE PROBLEMATIC QUERY! 🚨🚨🚨');
            console.error('Table:', table);
            console.error('Column:', column);
            console.error('Value:', value);
            console.error('This is the source of your 400 errors!');
            console.error('Call stack:');
            console.trace();
            debugger;
          }
          
          return originalEq.call(this, column, value);
        };
      }
      
      return queryBuilder;
    };
    
    return () => {
      supabase.from = originalFrom;
    };
  }, []);

const getOrCreateAnonymousSession = () => {
  const sessionKey = "anonymous_session_id";
  const timestampKey = "anonymous_session_timestamp";
  const now = Date.now();
  const MAX_SESSION_AGE_MS = 1 * 60 * 1000; // 1 minute for anon user to get a new one

  const lastTimestamp = parseInt(localStorage.getItem(timestampKey), 10);
  const isExpired = isNaN(lastTimestamp) || now - lastTimestamp > MAX_SESSION_AGE_MS;

  if (isExpired) {
    const newSessionId = `anon_${now}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(sessionKey, newSessionId);
    localStorage.setItem(timestampKey, now.toString());
    return newSessionId;
  }

  const existingSession = localStorage.getItem(sessionKey);
  return existingSession;
};


  const getOrCreateSessionId = () => {
    if (currentSessionId) return currentSessionId;

    const isAuthenticated = user?.id;
    const sessionId = isAuthenticated
      ? `session_${Date.now()}_${user.id}`
      : getOrCreateAnonymousSession();

    setCurrentSessionId(sessionId);
    return sessionId;
  };

  const saveAndAnalyzeCurrentDrawing = async () => {
    console.log("STARTING saveAndAnalyzeCurrentDrawing");

    if (currentDrawing.length < 1) {
      alert("Please draw something before saving.");
      return;
    }

    if (currentDrawing.length < 150) {
      alert(
        "Your spiral is too small for accurate analysis. Please draw a larger spiral that:\n\n• Makes at least 3-4 complete revolutions\n• Fills most of the drawing area\n• Is drawn in a continuous motion"
      );
      return;
    }

    const drawingToSave = [...currentDrawing];

    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
    setCurrentDrawing([]);

    const newDrawings = [...savedDrawings, drawingToSave];
    setSavedDrawings(newDrawings);

    setIsAnalyzing(true);
    
    const sessionId = getOrCreateSessionId();

    try {
      const drawingId = await saveSingleDrawingToDatabase(drawingToSave, sessionId);

      console.log(
        "About to send to API:",
        JSON.stringify(drawingToSave).substring(0, 200)
      );

      const result = await backgroundAnalysis(drawingToSave);
      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }
      
      await saveSingleAnalysisResult(drawingId, result, sessionId);

      console.log("Drawing saved and analyzed, stored in database");
    } catch (error) {
      console.error("Drawing analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const backgroundAnalysis = async (drawingData, drawingIndex = null) => {
    const startTime = performance.now();
    const TIMEOUT_MS = 70000; // 70 seconds timeout
    
    console.log(
      `Starting analysis ${
        drawingIndex !== null ? `#${drawingIndex + 1}` : ""
      } at ${new Date().toLocaleTimeString()}`
    );
    
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Analysis timeout: API did not respond within 70 seconds"));
        }, TIMEOUT_MS);
      });

      // Create the fetch promise
      const fetchPromise = fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawData: drawingData }),
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      console.log("API Response Status:", response.status);
      console.log("API Response Status Text:", response.statusText);

      let data;
      try {
        const responseText = await response.text();
        console.log(
          "API Response Text:",
          responseText.substring(0, 200) + "..."
        );
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        throw new Error(`Invalid JSON response from API: ${jsonError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Analysis failed with status ${response.status}`
        );
      }

      console.log("Full API result structure:", data.result);

      if (!data.result || typeof data.result !== "object") {
        throw new Error("Invalid analysis result received");
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(
        `Analysis ${
          drawingIndex !== null ? `#${drawingIndex + 1}` : ""
        } completed in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(
          2
        )}s)`
      );

      return data.result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (error.message.includes("timeout")) {
        console.warn(
          `Analysis ${
            drawingIndex !== null ? `#${drawingIndex + 1}` : ""
          } timed out after ${(duration / 1000).toFixed(2)}s:`,
          error.message
        );
        // Return a timeout result object
        return {
          status: "timeout",
          message: "N/A - Analysis timed out",
          error: error.message
        };
      } else {
        console.warn(
          `Analysis ${
            drawingIndex !== null ? `#${drawingIndex + 1}` : ""
          } failed after ${duration.toFixed(2)}ms:`,
          error.message
        );
        throw error;
      }
    }
  };

  const saveSingleDrawingToDatabase = async (drawingData, sessionId) => {
    const isAuthenticated = user?.id;
    console.log(
      `Saving drawing for ${
        isAuthenticated ? "authenticated" : "anonymous"
      } user`
    );
    const email = isAuthenticated
      ? user.email || "anonymous@example.com"
      : "anonymous@example.com";
    const username = isAuthenticated
      ? email.split("@")[0]
      : `anonymous_${sessionId.slice(-8)}`;

    // Check for pending demographics to include
    const pendingDemographics = localStorage.getItem('pendingDemographics');
    let demographicsData = {};
    
    if (pendingDemographics) {
      try {
        const parsed = JSON.parse(pendingDemographics);
        demographicsData = {
          user_name: parsed.name || null,
          user_age: parsed.age ? parseInt(parsed.age) : null,
          user_sex: parsed.sex || null
        };
        console.log('🔍 DEBUG: Including pending demographics:', demographicsData);
      } catch (e) {
        console.error('❌ DEBUG: Error parsing pending demographics:', e);
      }
    }

    const { data: savedDrawing, error } = await supabase
      .from("drawings")
      .insert({
        user_id: isAuthenticated ? user.id : null,
        email,
        username,
        drawing_data: drawingData,
        session_id: sessionId,
        is_anonymous: !isAuthenticated,
        hand_used: selectedHand,
        created_at: new Date().toISOString(),
        ...demographicsData
      })
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log(`✅ DEBUG: Saved drawing to database with ID: ${savedDrawing.id}`);
    
    // Clear pending demographics after successful save
    if (pendingDemographics) {
      localStorage.removeItem('pendingDemographics');
      console.log('✅ DEBUG: Cleared pending demographics after saving drawing');
    }
    
    return savedDrawing.id;
  };

  const saveSingleAnalysisResult = async (drawingId, analysisResult, sessionId) => {
    const isAuthenticated = user?.id;
    const email = isAuthenticated
      ? user.email || "anonymous@example.com"
      : "anonymous@example.com";
    const username = isAuthenticated
      ? email.split("@")[0]
      : `anonymous_${sessionId.slice(-8)}`;

    // Determine status based on analysis result
    const status = analysisResult.status === "timeout" ? "timeout" : "completed";

    const { error } = await supabase.from("api_results").insert({
      user_id: isAuthenticated ? user.id : null,
      email,
      username,
      drawing_id: drawingId,
      session_id: sessionId,
      is_anonymous: !isAuthenticated,
      status: status,
      result_data: {
        ...analysisResult,
        completed_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Failed to save analysis result:", error);
      throw error;
    }

    console.log(`Saved analysis result for drawing ${drawingId} with status: ${status}`);
  };

  const handleFinishEarly = useCallback(async () => {
    if (savedDrawings.length === 0) {
      alert("Please draw at least one spiral before finishing.");
      return;
    }
    setUserFinished(true);

    const sessionId = getOrCreateSessionId();
    const isAuthenticated = user?.id;

    const params = new URLSearchParams({
      session: sessionId,
      anon: (!isAuthenticated).toString(),
    });
    router.push(`/result/${sessionId}?${params.toString()}`);
  }, [savedDrawings, user, router]);

  const clearCurrentDrawing = () => {
    console.log("Clearing data for new drawing...");
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
  };

  const handleHandSelection = (hand) => {
    setSelectedHand(hand);
    // Store the hand selection in localStorage for persistence
    localStorage.setItem('selectedHand', hand);
  };

  const handleDemographicsSave = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      console.log('🔍 DEBUG: Attempting to save demographics for session:', sessionId);
      console.log('🔍 DEBUG: Demographics data:', demographics);
      
      // First, check if there are any drawings for this session
      const { data: existingDrawings, error: checkError } = await supabase
        .from('drawings')
        .select('id, session_id')
        .eq('session_id', sessionId);

      if (checkError) {
        console.error('❌ DEBUG: Error checking existing drawings:', checkError);
        alert(`Failed to check existing drawings: ${checkError.message}`);
        return;
      }

      console.log('🔍 DEBUG: Found drawings for session:', existingDrawings);

      if (!existingDrawings || existingDrawings.length === 0) {
        console.log('⚠️ DEBUG: No drawings found for session, demographics will be saved when first drawing is created');
        // Store demographics in localStorage to be saved when first drawing is created
        localStorage.setItem('pendingDemographics', JSON.stringify(demographics));
        localStorage.setItem('userDemographics', JSON.stringify(demographics));
        setShowDemographics(false);
        return;
      }

      // Update the drawings table with demographics for this session
      const { data: updateData, error } = await supabase
        .from('drawings')
        .update({
          user_name: demographics.name || null,
          user_age: demographics.age ? parseInt(demographics.age) : null,
          user_sex: demographics.sex || null
        })
        .eq('session_id', sessionId)
        .select();

      if (error) {
        console.error('❌ DEBUG: Error saving demographics:', error);
        alert(`Failed to save demographics: ${error.message}`);
        return;
      }

      console.log('✅ DEBUG: Demographics saved to database successfully');
      console.log('✅ DEBUG: Updated drawings:', updateData);
      localStorage.setItem('userDemographics', JSON.stringify(demographics));
      setShowDemographics(false);
    } catch (error) {
      console.error('❌ DEBUG: Unexpected error saving demographics:', error);
      alert('Failed to save demographics. Please try again.');
    }
  };

  const handleDemographicsClose = () => {
    setShowDemographics(false);
  };

  const clearAllDrawings = () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all your drawings? This will also reset your hand selection."
    );
    if (confirmed) {
      setCurrentDrawing([]);
      setSavedDrawings([]);
      setUserFinished(false);
      setCurrentSessionId(null);
      setSelectedHand(null);
      localStorage.removeItem('selectedHand');
      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }
    }
  };

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ position: "relative" }}>
        <div className={styles.machineContainer}>
          {/* Only show "Draw Here" title when hand is selected */}
          {selectedHand && <h1 className={styles.title}>Draw Here</h1>}

          {/* Hand indicator and help button in top right corner */}
          <div className={styles.topControlsContainer}>
            <div></div> {/* Empty div for left side */}
            
            <div className={styles.topRightControls}>
              {selectedHand && (
                <div className={styles.handIndicatorTopRight}>
                  <span className={styles.handIndicatorText}>
                    {selectedHand === 'dominant' ? 'Dominant' : 'Non-Dominant'} Hand
                  </span>
                  <button
                    onClick={() => {
                      if (savedDrawings.length === 0) {
                        setSelectedHand(null);
                      } else {
                        alert("Hand selection cannot be changed once drawings have been saved. Please clear all drawings first if you want to change hands.");
                      }
                    }}
                    className={styles.changeHandButtonTop}
                  >
                    Change
                  </button>
                </div>
              )}
              
              {selectedHand && (
                <button
                  className={styles.helpButton}
                  onClick={() => setShowTutorial(true)}
                  aria-label="Help"
                >
                  ?
                </button>
              )}
            </div>
          </div>

          {/* Hand Selection Buttons - Show first */}
          {!selectedHand && (
            <div className={styles.handSelectionContainer}>
              <h3 className={styles.handSelectionTitle}>
                Select Your Hand
                <FaHandPaper className={styles.handIcon} />
              </h3>
              <div className={styles.handButtonsWrapper}>
                <button
                  onClick={() => handleHandSelection('dominant')}
                  className={styles.handButton}
                >
                  Dominant Hand
                </button>
                <button
                  onClick={() => handleHandSelection('non-dominant')}
                  className={styles.handButton}
                >
                  Non-Dominant Hand
                </button>
              </div>
              
              {/* Optional Demographics button - only for non-logged in users */}
              {!user?.id && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  marginTop: '25px' 
                }}>
                  <button
                    onClick={() => setShowDemographics(true)}
                    style={{
                      backgroundColor: '#6fadebfa',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = '#2b74b8';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = '#6fadebfa';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    Optional Demographics
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Canvas and other buttons - Show after hand selection */}
          {selectedHand && (
            <>
              <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
              <MiniSpiralHistory savedDrawings={savedDrawings} />
              
              <div className={styles.buttonContainer}>
                <button
                  onClick={clearCurrentDrawing}
                  className={styles.clearCurrentButton}
                >
                  Clear
                </button>
                <button onClick={clearAllDrawings} className={styles.clearButton}>
                  Clear All
                </button>
              </div>
            </>
          )}

          {/* Save/Finish Button - Only show after hand selection */}
          {selectedHand && (
            <Button
              clearDrawing={clearCurrentDrawing}
              savedDrawingsCount={savedDrawings.length}
              onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
              isAnalyzing={isAnalyzing}
              onFinishEarly={handleFinishEarly}
              userFinished={userFinished}
            />
          )}
        </div>
      </div>
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} forceShow={true} />
      )}
      
      {/* Demographics Popup */}
      {showDemographics && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '15px',
            padding: '30px',
            width: '90%',
            maxWidth: '400px',
            position: 'relative',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Close button */}
            <button
              onClick={handleDemographicsClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
            
            <h2 style={{
              marginTop: '0',
              marginBottom: '25px',
              color: '#333',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Optional Demographics
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#333',
                fontWeight: '500'
              }}>
                Name:
              </label>
              <input
                type="text"
                value={demographics.name}
                onChange={(e) => setDemographics({...demographics, name: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  color: 'black'
                }}
                placeholder="Enter your name"
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#333',
                fontWeight: '500'
              }}>
                Age:
              </label>
              <input
                type="number"
                value={demographics.age}
                onChange={(e) => setDemographics({...demographics, age: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  color: 'black'
                }}
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#333',
                fontWeight: '500'
              }}>
                Sex:
              </label>
              <div style={{
                display: 'flex',
                gap: '10px'
              }}>
                <button
                  onClick={() => setDemographics({...demographics, sex: 'M'})}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: demographics.sex === 'M' ? '2px solid #6c757d' : '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: demographics.sex === 'M' ? '#6c757d' : 'white',
                    color: demographics.sex === 'M' ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: demographics.sex === 'M' ? '600' : '400'
                  }}
                >
                  Male (M)
                </button>
                <button
                  onClick={() => setDemographics({...demographics, sex: 'F'})}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: demographics.sex === 'F' ? '2px solid #6c757d' : '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: demographics.sex === 'F' ? '#6c757d' : 'white',
                    color: demographics.sex === 'F' ? 'white' : '#333',
                    cursor: 'pointer',
                    fontWeight: demographics.sex === 'F' ? '600' : '400'
                  }}
                >
                  Female (F)
                </button>
              </div>
            </div>
            
            <button
              onClick={handleDemographicsSave}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#6fadebfa',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#2b74b8';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#6fadebfa';
              }}
            >
              Save Demographics
            </button>
          </div>
        </div>
      )}
    </>
  );
}