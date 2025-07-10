"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from "recharts";

export default function LineGraph({ data }) {
    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 20, right: 30, bottom: 30, left: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="gray"/>
                    

                    <XAxis type="number" dataKey="x">
                        <Label value="X Coordinate (px)" offset={-20} position="insideBottom" fill="black" />
                    </XAxis>
                    

                    <YAxis type="number" dataKey="y" reversed={true}>
                         <Label value="Y Coordinate (px)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle'}} fill="black" />
                    </YAxis>


                    <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}

                        formatter={(value, name, props) => {

                            const { x } = props.payload;
                            return [
                                `Y: ${value.toFixed(2)} px`,
                                `X: ${x.toFixed(2)} px`
                            ];
                        }}

                        labelFormatter={() => ''}
                    />

                    <Line 
                        type="monotone" 
                        dataKey="y" 
                        name="Y Coordinate" 
                        stroke="#8884d8" 
                        dot={false} 
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}