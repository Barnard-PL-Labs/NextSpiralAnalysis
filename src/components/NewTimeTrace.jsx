import dynamic from 'next/dynamic';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => <div>Loading plot...</div>,
  onError: (error) => {
    console.error('Failed to load Plotly:', error);
    return <div>Failed to load plot</div>;
  }
});

const SpiralPlot = ({ data }) => {
  const plotData = [
    {
      x: data.map((d) => d.x),
      y: data.map((d) => d.y),
      z: data.map((d) => d.t),
      type: 'scatter3d',
      mode: 'lines',
      line: {
        width: 2,
        color: '#1f77b4',
      },
    },
  ];

  const layout = {
    margin: { l: 0, r: 0, b: 0, t: 0 },
    scene: {
      xaxis: { title:  'x'},
      yaxis: { title: 'y' },
      zaxis: { title:  't'},
    },
  };

  return <Plot data={plotData} layout={layout} style={{ width: '100%', height: '100%' }} />;
};

export default SpiralPlot