import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CanIAvoidBugByThis = (data) =>{
    const pdata = [];
    const startTime = data[0].t;

    for (let i =0; i<data.length; i++){
        pdata.push({p:data[i].p, t:data[i].t})
    }
    return pdata;
//     const plotData = data.map((d) => ({
//   t: (d.t - startTime) / 1000,
//   p: d.p,
// }));
};


const PTChart = ({ data }) => {

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            name="Time (s)"
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(tick) => `${tick.toFixed(2)}s`}
          />
          <YAxis dataKey="p" name="Pressure" />
          <Tooltip
            labelFormatter={(label) => `Elapsed Time: ${label.toFixed(2)}s`}
          />
          <Line type="monotone" dataKey="p" stroke="#8884d8" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export {CanIAvoidBugByThis,PTChart};

