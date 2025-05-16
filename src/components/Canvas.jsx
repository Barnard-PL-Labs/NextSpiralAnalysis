"use client";
import { useRef, useState, useEffect } from "react";
import styles from "@/styles/Canvas.module.css";

export default function Canvas({ setDrawData }) {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [localDrawData, setLocalDrawData] = useState([]); // original state (still here for compatibility)
    const [startTime, setStartTime] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [lastRecordedTime, setLastRecordedTime] = useState(0);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    const RECORD_INTERVAL = 16;

    const pointBufferRef = useRef([]); // !!! useRef to buffer drawing points

    useEffect(() => {
        // Detect if the device is touch-enabled
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;

        //Below is the background spiral for the machine page
        // const img = new Image();
        // img.src = "/Icons/spiraPic.png";
        // img.onload = () => {
        //     setBackgroundImage(img);
        //     drawBackgroundImage(ctx, img);
        // };

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
        ctx.beginPath(); //important to reset the path before drawing cross
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1.5;

        // Horizontal line
        ctx.moveTo(centerX - crossSize, centerY);
        ctx.lineTo(centerX + crossSize, centerY);

        // Vertical line
        ctx.moveTo(centerX, centerY - crossSize);
        ctx.lineTo(centerX, centerY + crossSize);

        ctx.stroke();
        ctx.restore();
    };

    // const drawBackgroundImage = (ctx, img) => {
    //     if (!ctx || !img) return;
    //     ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    //     ctx.globalAlpha = 0.1; // 
    //     ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    //     ctx.globalAlpha = 1;
    // };

    useEffect(() => {
        if (setDrawData && pointBufferRef.current.length > 0) {
            setDrawData(pointBufferRef.current); // !!! push buffer to parent
        }
    }, [setDrawData]);

    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.style.touchAction = "none";
        }
    }, []);

    const startDrawing = (event) => {
        setIsDrawing(true);
        const ctx = ctxRef.current;
        if (!ctx) return;

        ctx.beginPath();
        
        // Get coordinates relative to canvas
        const rect = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Handle pressure based on device type
        let pressure = 0.5; // Default pressure
        if (event.pointerType === 'pen' || (event.touches && event.touches[0])) {
            // For iPad/tablet: use actual pressure from touch
            pressure = event.pressure || (event.touches && event.touches[0].force) || 0.5;
        }

        const timeNow = Date.now();
        if (startTime === null) {
            setStartTime(timeNow);
        }

        setLastRecordedTime(timeNow); // !!! reset interval
        pointBufferRef.current = []; // !!! clear buffer

        const newPoint = {
            n: 1,
            x: Number(x.toFixed(4)),
            y: Number(y.toFixed(4)),
            p: Number((pressure * 1000).toFixed()),
            t: 0
        };

        pointBufferRef.current.push(newPoint); // !!! add to buffer
    };

    const draw = (event) => {
        if (!isDrawing) return;

        // Get coordinates relative to canvas
        const rect = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Handle pressure based on device type
        let pressure = 0.5; // Default pressure
        if (event.pointerType === 'pen' || (event.touches && event.touches[0])) {
            // For iPad/tablet: use actual pressure from touch
            pressure = event.pressure || (event.touches && event.touches[0].force) || 0.5;
        }

        const timeNow = Date.now();
        const relativeTime = startTime ? timeNow - startTime : 0;

        if (timeNow - lastRecordedTime < RECORD_INTERVAL) return;
        setLastRecordedTime(timeNow);

        const newPoint = {
            n: pointBufferRef.current.length + 1, // !!! use buffer for length
            x: Number(x.toFixed(4)),
            y: Number(y.toFixed(4)),
            p: Number((pressure * 1000).toFixed()),
            t: relativeTime
        };

        // !!! add point only if x/y/p changed
        const last = pointBufferRef.current[pointBufferRef.current.length - 1];
        if (!last || last.x !== newPoint.x || last.y !== newPoint.y || last.p !== newPoint.p) {
            pointBufferRef.current.push(newPoint);
        }

        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        ctxRef.current?.beginPath();
        setDrawData([...pointBufferRef.current]); // !!! commit buffer to state
        setLocalDrawData([...pointBufferRef.current]); // optional: keep in local state too
    };

    const clearCanvas = () => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        setLocalDrawData([]);
        pointBufferRef.current = []; // !!! clear buffer
        if (backgroundImage) {
            drawBackgroundImage(ctx, backgroundImage); 
        }
    };

    return (
        <div className={styles.canvasContainer}>
            <canvas
                ref={canvasRef}
                width={500}
                height={500}
                className={styles.spiralCanvas}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
            />
        </div>
    );
}
