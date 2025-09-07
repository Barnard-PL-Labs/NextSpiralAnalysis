"use client";
import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";

const styles = {
  canvasContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '20px auto',
    width: '100%',
  },
  spiralCanvas: {
    border: '2px solid black',
    backgroundColor: 'white',
    cursor: 'crosshair',
    touchAction: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  },
};

const Canvas = forwardRef(({ setDrawData }, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [localDrawData, setLocalDrawData] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const pointBufferRef = useRef([]);
  const renderBufferRef = useRef([]);
  const animationFrameIdRef = useRef(null);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);

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
    const centerX = width / 2;
    const centerY = height / 2;
    const crossSize = 10;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;

    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);

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
    let pressure = 0.5; // default for mouse
    if (event.pointerType === "pen" || (event.touches && event.touches[0])) {
      pressure =
        event.pressure || (event.touches && event.touches[0].force) || 0.5;
    } else if (event.pointerType === "touch") {
      pressure = event.pressure;
    }
    return { x, y, pressure };
  };

  const renderLoop = useCallback(() => {
    if (renderBufferRef.current.length === 0) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const pointsToDraw = [...renderBufferRef.current];
    renderBufferRef.current = [];

    if (pointsToDraw.length > 0) {
      for (let i = 0; i < pointsToDraw.length; i++) {
        ctx.lineTo(pointsToDraw[i].x, pointsToDraw[i].y);
      }
      ctx.stroke();
    }

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const startDrawing = (event) => {
    // NEW: if a previous stroke exists, clear everything before starting a new one
    if (localDrawData.length > 0) {
      clearCanvas(); // also resets setDrawData([]) and buffers
    }

    setIsDrawing(true);
    const timeNow = Date.now();
    setStartTime(timeNow);

    pointBufferRef.current = [];
    renderBufferRef.current = [];

    const { x, y, pressure } = getPointerData(event);
    const newPoint = {
      n: 1,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      p: Number((pressure * 1000).toFixed()),
      t: 0,
    };

    pointBufferRef.current.push(newPoint);

    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);
  };

  const draw = (event) => {
    if (!isDrawing) return;

    const { x, y, pressure } = getPointerData(event);
    const timeNow = Date.now();
    const relativeTime = startTime ? timeNow - startTime : 0;

    const newPoint = {
      n: pointBufferRef.current.length + 1,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      p: Number((pressure * 1000).toFixed()),
      t: relativeTime,
    };

    pointBufferRef.current.push(newPoint);
    renderBufferRef.current.push({ x, y });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    setDrawData([...pointBufferRef.current]);
    setLocalDrawData([...pointBufferRef.current]);
  };

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    pointBufferRef.current = [];
    renderBufferRef.current = [];
    setLocalDrawData([]);
    setDrawData([]);
    setStartTime(null);
    drawCenterCross(ctx);
    if (backgroundImage) {
      drawBackgroundImage(ctx, backgroundImage);
    }
  };

  useImperativeHandle(ref, () => ({ clearCanvas }));

  return (
    <div style={styles.canvasContainer}>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        style={styles.spiralCanvas}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </div>
  );
});

Canvas.displayName = "Canvas";
export default Canvas;
