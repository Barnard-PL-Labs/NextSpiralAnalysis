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
    margin: "20px auto",
    width: "100%",
  },
  spiralCanvas: {
    border: "2px solid black",
    backgroundColor: "white",
    cursor: "crosshair",
    touchAction: "none",
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
  },
};

const Canvas = forwardRef(({ setDrawData }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [localDrawData, setLocalDrawData] = useState([]);
  const [startStamp, setStartStamp] = useState(null); // use event.timeStamp origin
  const [backgroundImage, setBackgroundImage] = useState(null);

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
    ctx.beginPath();
    ctx.strokeStyle = "#888";
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
    </div>
  );
});

Canvas.displayName = "Canvas";
export default Canvas;
