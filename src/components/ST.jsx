"use client";
import React from "react";
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,} from "recharts";

const calculateSpeed = (data) => {
    let speedData = []; 
    if (!data || data.length < 2) return [];
    
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
    
        const deltaX = curr.x - prev.x;
        const deltaY = curr.y - prev.y;
        const deltaT = curr.t - prev.t;
    
        if (deltaT === 0) continue;
        const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
        const speed = distance / deltaT;
    
        speedData.push({
            time: curr.t, 
            speed: speed.toFixed(2),
        });
    }
    return speedData;
}

const SpeedTimeChart = ({ speedData }) => {
      return (
        <div style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="gray" />
              <XAxis
                dataKey="time"
                stroke="black"
                label={{
                  value: "Time (ms)",
                  position: "insideBottom",
                  dy: 10,
                  fill: "black",
                }}
              />
              <YAxis
                dataKey="speed"
                stroke="black"
                label={{
                  value: "Speed (px/ms)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "black",
                }}
              />
          <Tooltip
            labelFormatter={(label) => `Time: ${label} ms`}
            // This formatter now safely handles string inputs
            formatter={(value) => [`${parseFloat(value).toFixed(2)} px/ms`, "Speed"]}
          />

              <Line
                type="monotone"
                dataKey="speed"
                stroke="#8884d8"
                strokeWidth={2}
                name="Speed"
                dot={{ r: 3, fill: "cyan" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    };
  
export {SpeedTimeChart, calculateSpeed};
