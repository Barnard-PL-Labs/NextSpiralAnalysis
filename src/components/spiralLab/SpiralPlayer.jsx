"use client";
// The spiral plus playback controls, like a video player:
//   Watch it draw / Pause / Resume -- play the pen in real time, stop where it is
//   Show finished                  -- jump straight to the finished spiral
//   timeline                       -- drag to any moment of the drawing
// Playback state lives here so the rest of the page doesn't re-render every frame.
import { useEffect, useRef, useState } from "react";
import styles from "@/styles/SpiralLab.module.css";
import SpiralCanvas from "@/components/spiralLab/SpiralCanvas";

const SPEEDS = [0.5, 1, 2, 4];

export default function SpiralPlayer({ spiral, showSpeed = false, fit = "canvas" }) {
  const total = spiral ? spiral.points[spiral.points.length - 1].t : 0;
  // null = the finished spiral; a number = the moment shown, in ms.
  const [position, setPosition] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const positionRef = useRef(null);

  const moveTo = (ms) => {
    positionRef.current = ms;
    setPosition(ms);
  };

  // A different spiral starts out finished.
  useEffect(() => {
    setPlaying(false);
    moveTo(null);
  }, [spiral]);

  useEffect(() => {
    if (!playing) return undefined;
    let frame;
    let last = performance.now();
    const tick = (now) => {
      const next = (positionRef.current ?? 0) + (now - last) * speed;
      last = now;
      if (next >= total) {
        moveTo(null);
        setPlaying(false);
        return;
      }
      moveTo(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total]);

  const midway = position != null;

  const play = () => {
    if (!midway) moveTo(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const finish = () => {
    setPlaying(false);
    moveTo(null);
  };
  const startOver = () => {
    moveTo(0);
    setPlaying(true);
  };
  const scrub = (ms) => {
    setPlaying(false);
    moveTo(ms >= total ? null : ms);
  };

  const shown = position ?? total;

  return (
    <>
      <SpiralCanvas spiral={spiral} untilMs={position} fit={fit} />
      <div className={styles.player} aria-label="Playback">
        {playing ? (
          <button type="button" className={styles.button} onClick={pause}>
            Pause
          </button>
        ) : (
          <button type="button" className={`${styles.button} ${styles.playButton}`} disabled={!spiral} onClick={play}>
            {midway ? "Resume" : "Watch it draw"}
          </button>
        )}
        {midway && (
          <>
            <button type="button" className={styles.button} onClick={startOver}>
              Start over
            </button>
            <button type="button" className={styles.button} onClick={finish}>
              Show finished
            </button>
          </>
        )}
        <input
          className={`${styles.range} ${styles.scrubber}`}
          type="range"
          min={0}
          max={total || 1}
          step={10}
          value={shown}
          disabled={!spiral}
          aria-label="Drawing timeline"
          onChange={(e) => scrub(Number(e.target.value))}
        />
        <span className={styles.time}>
          {(shown / 1000).toFixed(1)} / {(total / 1000).toFixed(1)} s
        </span>
        {showSpeed && (
          <div className={styles.segmented} role="group" aria-label="Playback speed">
            {SPEEDS.map((v) => (
              <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
