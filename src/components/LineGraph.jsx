"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function LineGraph({ data }) {
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                    <CartesianGrid />
                    <XAxis type="number" dataKey="x" name="X Coordinate" />
                    <YAxis type="number" dataKey="y" name="Y Coordinate" reversed={true} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
