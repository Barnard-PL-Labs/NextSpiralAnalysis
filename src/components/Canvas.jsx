"use client";
import { useRef, useState, useEffect } from "react";
import styles from "@/styles/Canvas.module.css";

export default function Canvas({ setDrawData }) {
    const canvasRef = useRef(null);
    const ctxRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [localDrawData, setLocalDrawData] = useState([]);
    const [startTime, setStartTime] = useState(null);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [lastRecordedTime, setLastRecordedTime] = useState(0);

    const RECORD_INTERVAL = 10; 

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctxRef.current = ctx;

        
        const img = new Image();
        img.src = "/Icons/spiraPic.png";
        img.onload = () => {
            setBackgroundImage(img);
            drawBackgroundImage(ctx, img);
        };

        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
    }, []);


    const drawBackgroundImage = (ctx, img) => {
        if (!ctx || !img) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 0.1; // 
        ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 1;
    };

    useEffect(() => {
        if (setDrawData && localDrawData.length > 0) {
            setDrawData(localDrawData);
        }
    }, [localDrawData, setDrawData]);

    const startDrawing = (event) => {
        setIsDrawing(true);
        const { offsetX, offsetY, pressure } = event.nativeEvent;
        const timeNow = Date.now();

        if (startTime === null) {
            setStartTime(timeNow);
        }

        const newPoint = { "n": 1, "x": offsetX, "y": offsetY, "p": pressure || 1.0, "t": 0 };
        setLocalDrawData([newPoint]);
    };

    const draw = (event) => {
        if (!isDrawing) return;
        const { offsetX, offsetY, pressure } = event.nativeEvent;
        const timeNow = Date.now();
        const relativeTime = startTime ? timeNow - startTime : 0;

        if (timeNow - lastRecordedTime < RECORD_INTERVAL) return;
        setLastRecordedTime(timeNow);

        const newPoint = {
            n: localDrawData.length + 1,
            x: offsetX,
            y: offsetY,
            p: pressure || 1.0,
            t: relativeTime
        };

        setLocalDrawData((prevData) => [...prevData, newPoint]);

        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        ctxRef.current?.beginPath();
    };

    const clearCanvas = () => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        setLocalDrawData([]);
        if (backgroundImage) {
            drawBackgroundImage(ctx, backgroundImage); // ✅ Redraw background after clearing
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
