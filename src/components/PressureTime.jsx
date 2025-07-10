'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CanIAvoidBugByThis = (data) =>{
    const pdata = [];
    const startTime = data[0].t;

    for (let i =0; i<data.length; i++){
        pdata.push({p:data[i].p, t:data[i].t})
    }
    return pdata;
};


const PTChart = ({ data }) => {

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="gray" />
          <XAxis
            dataKey="t"
            name="Time (ms)"
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(tick) => `${tick.toFixed(2)}`}
                            label={{
                  value: "Time (ms)",
                  position: "insideBottom",
                  dy: 10,
                  fill: "black",
                }}
          />
          <YAxis dataKey="p" name="Pressure"                 label={{
                  value: "Pressure",
                  angle: -90,
                  position: "insideLeft",
                  fill: "black",
                }} />
          <Tooltip
            labelFormatter={(label) => `Time: ${label.toFixed(0)}ms`}
            formatter={(value) => [value.toFixed(0), 'Pressure']} 
          />
          <Line type="monotone" dataKey="p" stroke="#8884d8" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export {CanIAvoidBugByThis,PTChart};

