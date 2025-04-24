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

    const RECORD_INTERVAL = 1; 

    useEffect(() => {
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
        ctx.beginPath(); // ✅ important to reset the path before drawing cross
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
        if (setDrawData && localDrawData.length > 0) {
            setDrawData(localDrawData);
        }
    }, [localDrawData, setDrawData]);
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
        const { offsetX, offsetY, pressure } = event.nativeEvent;
        const timeNow = Date.now();

        if (startTime === null) {
            setStartTime(timeNow);
        }

        const newPoint = { "n": 1, "x": offsetX, "y": offsetY, "p":(pressure) < 1000?  5000.0: pressure, "t": 0 };
         {/* I set if p is lower then 1000 then key in 5000 instead*/}
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
            p: (pressure) < 1000?  5000.0: pressure,
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
