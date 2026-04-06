"use client";
import {
  useRef, useState, useEffect, useImperativeHandle,
  forwardRef, useCallback,
} from "react";

const styles = {
  canvasContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "0 auto",
    width: "100%",
    position: "relative",
  },
  spiralCanvas: {
    border: "1.5px solid #d0d7e6",
    backgroundColor: "white",
    cursor: "crosshair",
    touchAction: "none",
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    display: "block",
  },
  startHint: {
    position: "absolute",
    top: "16px",
    left: "12px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    padding: "5px 14px",
    fontSize: "13px",
    color: "#64748b",
    pointerEvents: "none",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    whiteSpace: "nowrap",
  },
};

const Canvas = forwardRef(({ setDrawData }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [localDrawData, setLocalDrawData] = useState([]);
  const [startStamp, setStartStamp] = useState(null); // use event.timeStamp origin
  const [backgroundImage] = useState(null);

  const pointBufferRef = useRef([]);
  const renderBufferRef = useRef([]);
  const animationFrameIdRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    drawCenterCross(ctx);
  }, []);

  const drawCenterCross = (ctx) => {
    if (!ctx) return;
    const { width, height } = ctx.canvas;
    const cx = width / 2, cy = height / 2, s = 10;
    ctx.save();

    // Dashed vertical center line
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.strokeStyle = "#d0d7e6";
    ctx.lineWidth = 1;
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center cross
    ctx.beginPath();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
    ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
    ctx.stroke();

    ctx.restore();
  };

  const drawBackgroundImage = (ctx, img) => {
    if (!ctx || !img) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 0.1;
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
  };

  const getPointerData = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let pressure = 0.5;
    if (event.pointerType === "pen") pressure = event.pressure ?? 0.5;
    else if (event.pointerType === "touch") pressure = event.pressure ?? 0.5;
    return { x, y, pressure };
  };

  const renderLoop = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (renderBufferRef.current.length) {
      for (let i = 0; i < renderBufferRef.current.length; i++) {
        const pt = renderBufferRef.current[i];
        ctx.lineTo(pt.x, pt.y);
      }
      renderBufferRef.current = [];
      ctx.stroke();
    }
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const startDrawing = useCallback((e) => {
    // If a previous stroke exists, clear before starting a new one
    if (localDrawData.length > 0) clearCanvas();

    setIsDrawing(true);
    // Use the event timestamp as a monotonic origin for this stroke
    setStartStamp(e.timeStamp);

    pointBufferRef.current = [];
    renderBufferRef.current = [];

    // Capture the pointer so move/ups stay on the canvas
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const { x, y, pressure } = getPointerData(e);
    const firstPoint = {
      n: 1,
      x: +x.toFixed(4),
      y: +y.toFixed(4),
      p: Math.round((pressure ?? 0.5) * 1000),
      t: 0,
    };
    pointBufferRef.current.push(firstPoint);

    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);

    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    }
  }, [localDrawData, renderLoop]);

  // High-rate input handler: coalesced + rawupdate
  const handleInput = useCallback((event) => {
    if (!isDrawing) return;

    const samples = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    for (const e of samples) {
      const { x, y, pressure } = getPointerData(e);
      const relT = startStamp != null ? (e.timeStamp - startStamp) : 0;

      const newPoint = {
        n: pointBufferRef.current.length + 1,
        x: +x.toFixed(4),
        y: +y.toFixed(4),
        p: Math.round((pressure ?? 0.5) * 1000),
        t: Math.max(0, Math.round(relT)), // ms, non-decreasing
      };
      pointBufferRef.current.push(newPoint);
      renderBufferRef.current.push({ x, y });
    }
  }, [isDrawing, startStamp]);

  // Add pointerrawupdate for Chromium/Android/Windows (Safari ignores this)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onRaw = (e) => handleInput(e);
    c.addEventListener("pointerrawupdate", onRaw, { passive: true });
    return () => c.removeEventListener("pointerrawupdate", onRaw);
  }, [handleInput]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setDrawData([...pointBufferRef.current]);
    setLocalDrawData([...pointBufferRef.current]);
  }, [isDrawing, setDrawData]);

  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    pointBufferRef.current = [];
    renderBufferRef.current = [];
    setLocalDrawData([]);
    setDrawData([]);
    setStartStamp(null);
    drawCenterCross(ctx);
    if (backgroundImage) drawBackgroundImage(ctx, backgroundImage);
  }, [backgroundImage, setDrawData]);

  useImperativeHandle(ref, () => ({ clearCanvas }));

  return (
    <div style={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        style={styles.spiralCanvas}
        onPointerDown={startDrawing}
        onPointerMove={handleInput}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      {localDrawData.length === 0 && (
        <div style={styles.startHint}>Start from the center</div>
      )}
    </div>
  );
});

Canvas.displayName = "Canvas";
export default Canvas;
