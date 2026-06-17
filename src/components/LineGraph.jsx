"use client";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from "recharts";

const LEFT_COLOR  = "#3b82f6";  // blue
const RIGHT_COLOR = "#ec80ff";  // light pink

export default function LineGraph({ data }) {
    if (!data || data.length < 2) return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
            No data
        </div>
    );

    const xs = data.map((p) => p.x);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;

    // Split into alternating left/right segments; overlap by 1 point so lines meet
    const segments = [];
    let cur = { side: data[0].x < centerX ? "left" : "right", points: [data[0]] };
    for (let i = 1; i < data.length; i++) {
        const side = data[i].x < centerX ? "left" : "right";
        if (side === cur.side) {
            cur.points.push(data[i]);
        } else {
            segments.push(cur);
            cur = { side, points: [data[i - 1], data[i]] };
        }
    }
    segments.push(cur);

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="gray" />

                    <XAxis type="number" dataKey="x" name="X" domain={["auto", "auto"]}>
                        <Label value="X Coordinate (px)" offset={-20} position="insideBottom" fill="black" />
                    </XAxis>

                    <YAxis type="number" dataKey="y" name="Y" reversed={true} domain={["auto", "auto"]}>
                        <Label value="Y Coordinate (px)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} fill="black" />
                    </YAxis>

                    <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(value, name) => [`${value.toFixed(2)} px`, name]}
                    />

                    {segments.map((seg, i) => (
                        <Scatter
                            key={i}
                            data={seg.points}
                            line={{ stroke: seg.side === "left" ? LEFT_COLOR : RIGHT_COLOR, strokeWidth: 2 }}
                            lineType="joint"
                            shape={() => null}
                        />
                    ))}
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
}
