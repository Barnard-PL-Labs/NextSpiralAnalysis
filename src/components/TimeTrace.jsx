// "use client";
// import React, { useEffect, useRef } from "react";
// import * as d3 from "d3";
// import { ResponsiveContainer } from "recharts";

// const Spiral3D = ({ drawData }) => {
//   const svgRef = useRef();

//   useEffect(() => {
//     if (!drawData || drawData.length === 0) return;

//     const width = 600;
//     const height = 400;
//     const originX = 100;
//     const originY = height - 200;
//     const focalLength = 300;

//     const getPaddedDomain = (arr, padRatio = 0.1) => {
//       const [min, max] = d3.extent(drawData, d => d[arr]);
//       const range = max - min;
//       return [min - range * padRatio, max];
//     };

//     const xScale = d3.scaleLinear().domain(getPaddedDomain("x")).range([0, 150]);
//     const yScale = d3.scaleLinear().domain(getPaddedDomain("y")).range([0, 150]);
//     const tScale = d3.scaleLinear().domain(getPaddedDomain("t")).range([0, 180]);

//     const project3D = (x, y, t) => {
//       const scale = focalLength / (focalLength + tScale(t));
//       return {
//         x: originX + xScale(x),
//         y: originY - yScale(y),
//         t: originY - tScale(t),
//         scale: scale,
//       };
//     };

//     const svg = d3.select(svgRef.current);
//     svg.selectAll("*").remove();

//     const projectedData = drawData
//       .map(d => project3D(d.x, d.y, d.t))
//       .filter(d => d !== null);

//     if (projectedData.length === 0) return;
//     projectedData.sort((a, b) => b.t - a.t);

//     const axisGroup = svg.append("g");

//     const maxX = d3.max(drawData, d => d.x);
//     const projectedMaxX = tScale(maxX);    
//     const maxY = d3.max(drawData, d => d.y);
//     const projectedMaxY = tScale(maxY);
//     const maxT = d3.max(drawData, d => d.t);
//     const projectedMaxT = tScale(maxT);

//     // X Axis
//     axisGroup.append("line")
//       .attr("x1", originX)
//       .attr("y1", originY)
//       .attr("x2", originX + 160)
//       .attr("y2", originY)
//       .attr("stroke", "black")
//       .attr("stroke-width", 1);

//     axisGroup.append("text")
//       .attr("x", originX + 165)
//       .attr("y", originY + 10)
//       .attr("fill", "black")
//       .attr("font-size", 10)
//       .text("X");

//     // Y Axis
//     axisGroup.append("line")
//       .attr("x1", originX)
//       .attr("y1", originY)
//       .attr("x2", originX - 48)
//       .attr("y2", originY - 80)
//       .attr("stroke", "black")
//       .attr("stroke-width", 1);

//     axisGroup.append("text")
//       .attr("x", originX - 48 - 10)
//       .attr("y", originY - 80)
//       .attr("fill", "black")
//       .attr("font-size", 10)
//       .text("Y");

//     // T Axis


//     axisGroup.append("line")
//       .attr("x1", originX)
//       .attr("y1", originY)
//       .attr("x2", originX)
//       .attr("y2", originY - projectedMaxT)
//       .attr("stroke", "black")
//       .attr("stroke-width", 1);

//     axisGroup.append("text")
//       .attr("x", originX - 10)
//       .attr("y", originY - projectedMaxT)
//       .attr("fill", "black")
//       .attr("font-size", 10)
//       .text("T");

//     // Tick marks and labels
//     const xTicks = xScale.ticks(2).filter(d => d !== 0); // Remove 0
//     axisGroup.selectAll(".x-tick")
//       .data(xTicks)
//       .enter()
//       .append("line")
//       .attr("x1", d => originX + xScale(d))
//       .attr("y1", originY)
//       .attr("x2", d => originX + xScale(d))
//       .attr("y2", originY + 5)
//       .attr("stroke", "black");

//       axisGroup.selectAll(".x-label")
//         .data(xTicks)
//         .enter()
//         .append("text")
//         .attr("x", d => originX + xScale(d))
//         .attr("y", originY + 18)
//         .attr("text-anchor", "middle")
//         .attr("font-size", 10)
//         .text(d => Math.round(d)); // round to nearest whole number
      

//     //     const yTicks = yScale.ticks(1).filter(d => d > 0);
//     // axisGroup.selectAll(".y-tick")
//     //   .data(yTicks)
//     //   .enter()
//     //   .append("line")
//     //   .attr("x1", d => originX - yScale(d) * 0.6)
//     //   .attr("y1", d => originY - yScale(d) * 0.8)
//     //   .attr("x2", d => originX - yScale(d) * 0.6 - 5)
//     //   .attr("y2", d => originY - yScale(d) * 0.8 - 5)
//     //   .attr("stroke", "black");

// //  // only top value
// //       axisGroup.selectAll(".y-label")
// //         .data(yTicks)
// //         .enter()
// //         .append("text")
// //         .attr("x", d => originX - yScale(d) * 0.6 - 10)
// //         .attr("y", d => originY - yScale(d) * 0.8 - 5)
// //         .attr("text-anchor", "end")
// //         .attr("font-size", 10)
// //         .text(d => Math.round(d));
      

//       const tTicks = tScale.ticks(2).filter(d => d > 0); // filter out 0
//     axisGroup.selectAll(".t-tick")
//       .data(tTicks)
//       .enter()
//       .append("line")
//       .attr("x1", originX)
//       .attr("y1", d => originY - tScale(d))
//       .attr("x2", originX - 5)
//       .attr("y2", d => originY - tScale(d))
//       .attr("stroke", "black");

//       axisGroup.selectAll(".t-label")
//         .data(tTicks)
//         .enter()
//         .append("text")
//         .attr("x", originX - 8)
//         .attr("y", d => originY - tScale(d) + 3)
//         .attr("text-anchor", "end")
//         .attr("font-size", 10)
//         .text(d => Math.round(d / 100) * 100); // round to nearest 100
      
//     // Spiral path
//     const line = d3.line()
//       .x(d => d.x)
//       .y(d => d.t)
//       .curve(d3.curveCardinal);

//     svg.append("path")
//       .datum(projectedData)
//       .attr("fill", "none")
//       .attr("stroke", "cyan")
//       .attr("stroke-width", 1.5)
//       .attr("d", line);

//     // Spiral points
//     svg.selectAll("circle")
//       .data(projectedData)
//       .enter()
//       .append("circle")
//       .attr("cx", d => d.x)
//       .attr("cy", d => d.t)
//       .attr("r", d => 3 * d.scale)
//       .attr("fill", d => d3.interpolateCool(d.scale));

//   }, [drawData]);

//   return (<div>
// <svg ref={svgRef} width="100%" height="300px" style={{ background: "transparent", display: "flex", }}></svg>

// </div>
//   )
// };

// export default Spiral3D;

// // "use client";
// // import React, { useEffect, useRef } from "react";
// // import * as d3 from "d3";

// // const Spiral3D = ({ drawData }) => {
// //   const svgRef = useRef();

// //   useEffect(() => {
// //     if (!drawData || drawData.length === 0) return;

// //     // Set up dimensions (unchanged)
// //     const width = 600;
// //     const height = 400; 
// //     const originX = 100; 
// //     const originY = height-200; 
// //     const focalLength = 300;

// //     // // Normalize Data (No scaling changes)
// //     // const xScale = d3.scaleLinear()
// //     //   .domain([0, d3.max(drawData, d => d.x)])
// //     //   .range([0, 150]);

// //     // const yScale = d3.scaleLinear()
// //     //   .domain([0, d3.max(drawData, d => d.y)])
// //     //   .range([0, 150]);

// //     // const tScale = d3.scaleLinear()
// //     //   .domain([0, d3.max(drawData, d => d.t)])
// //     //   .range([0, 180]);
// //     const getPaddedDomain = (arr, padRatio = 0.1) => {
// //       const [min, max] = d3.extent(drawData, d => d[arr]);
// //       const range = max - min;
// //       return [min - range * padRatio, max];
// //     };
    
// //     const xScale = d3.scaleLinear()
// //       .domain(getPaddedDomain("x"))
// //       .range([0, 150]);
    
// //     const yScale = d3.scaleLinear()
// //       .domain(getPaddedDomain("y"))
// //       .range([0, 150]);
    
// //     const tScale = d3.scaleLinear()
// //       .domain(getPaddedDomain("t"))
// //       .range([0, 180]);
    


// //     // Perspective projection function
// //     const project3D = (x, y, t) => {
// //       const scale = focalLength / (focalLength + tScale(t));
// //       return {
// //         x: originX + xScale(x),
// //         y: originY - yScale(y),
// //         t: originY - tScale(t),
// //         scale: scale,
// //       };
// //     };

// //     // Select SVG and clear previous content
// //     const svg = d3.select(svgRef.current);
// //     svg.selectAll("*").remove();

// //     // Apply transformation & filter invalid points
// //     const projectedData = drawData
// //       .map((d) => project3D(d.x, d.y, d.t))
// //       .filter(d => d !== null);

// //     if (projectedData.length === 0) return;

// //     // Sort points by T-axis (depth sorting)
// //     projectedData.sort((a, b) => b.t - a.t);

// //     // Draw Axes (No scaling, just shifting left and up)
// //     const axisGroup = svg.append("g");

// //     // X-Axis (Left-aligned)
// //     axisGroup.append("line")
// //       .attr("x1", originX).attr("y1", originY)
// //       .attr("x2", originX + 160).attr("y2", originY)
// //       .attr("stroke", "black").attr("stroke-width", 1);
// //       axisGroup.append("text")
// //   .attr("x", originX + 160 + 5)
// //   .attr("y", originY + 10)
// //   .attr("fill", "black")
// //   .attr("font-size", 10)
// //   .text("X");


// //     // Y-Axis (Left-aligned)
// //     axisGroup.append("line")
// //       .attr("x1", originX).attr("y1", originY)
// //       .attr("x2", originX - 48).attr("y2", originY - 80)
// //       .attr("stroke", "black").attr("stroke-width", 1)
// //       .attr("stroke-dasharray", "3,3");
// //       axisGroup.append("text")
// //   .attr("x", originX - 80 - 15)
// //   .attr("y", originY - 40)
// //   .attr("fill", "black")
// //   .attr("font-size", 10)
// //   .text("Y");

// //   const maxT = d3.max(drawData, d => d.t);
// //   const projectedMaxT = tScale(maxT);

// //     // T-Axis (Left-aligned)
// //     axisGroup.append("line")
// //     .attr("x1", originX).attr("y1", originY)
// //     .attr("x2", originX).attr("y2", originY - projectedMaxT)
// //     .attr("stroke", "black")
// //     .attr("stroke-width", 1);
  
// //     axisGroup.append("text")
// //     .attr("x", originX - 10)
// //     .attr("y", originY - projectedMaxT)
// //     .attr("fill", "black")
// //     .attr("font-size", 10)
// //     .text("T");

// //     // Assuming xScale, yScale, and tScale are already defined as in your existing code

// //     const xTicks = xScale.ticks(2);
// //     axisGroup.selectAll(".x-tick")
// //       .data(xTicks)
// //       .enter()
// //       .append("line")
// //       .attr("x1", d => originX + xScale(d))
// //       .attr("y1", originY)
// //       .attr("x2", d => originX + xScale(d))
// //       .attr("y2", originY + 5)
// //       .attr("stroke", "black");
    
// //     axisGroup.selectAll(".x-label")
// //       .data(xTicks)
// //       .enter()
// //       .append("text")
// //       .attr("x", d => originX + xScale(d))
// //       .attr("y", originY + 18)
// //       .attr("text-anchor", "middle")
// //       .attr("font-size", 10)
// //       .text(d => d.toFixed(2));
// //       const yTicks = yScale.ticks(2);
// //       axisGroup.selectAll(".y-tick")
// //         .data(yTicks)
// //         .enter()
// //         .append("line")
// //         .attr("x1", d => originX - yScale(d) * 0.6) // line angle
// //         .attr("y1", d => originY - yScale(d) * 0.8)
// //         .attr("x2", d => originX - yScale(d) * 0.6 - 5)
// //         .attr("y2", d => originY - yScale(d) * 0.8 - 5)
// //         .attr("stroke", "black")
// //         .attr("stroke-dasharray", "3,3");
      
// //       axisGroup.selectAll(".y-label")
// //         .data(yTicks)
// //         .enter()
// //         .append("text")
// //         .attr("x", d => originX - yScale(d) * 0.6 - 10)
// //         .attr("y", d => originY - yScale(d) * 0.8 - 5)
// //         .attr("text-anchor", "end")
// //         .attr("font-size", 10)
// //         .text(d => d.toFixed(2));
        
// //         const tTicks = tScale.ticks(2);
// //         axisGroup.selectAll(".t-tick")
// //           .data(tTicks)
// //           .enter()
// //           .append("line")
// //           .attr("x1", originX)
// //           .attr("y1", d => originY - tScale(d))
// //           .attr("x2", originX - 5)
// //           .attr("y2", d => originY - tScale(d))
// //           .attr("stroke", "black");
        
// //         axisGroup.selectAll(".t-label")
// //           .data(tTicks)
// //           .enter()
// //           .append("text")
// //           .attr("x", originX - 8)
// //           .attr("y", d => originY - tScale(d) + 3)
// //           .attr("text-anchor", "end")
// //           .attr("font-size", 10)
// //           .text(d => d.toFixed(2));
                  
  


// //     // Draw Spiral Path
// //     const line = d3.line()
// //       .x(d => d.x)
// //       .y(d => d.t)
// //       .curve(d3.curveCardinal);

// //     svg.append("path")
// //       .datum(projectedData)
// //       .attr("fill", "none")
// //       .attr("stroke", "cyan")
// //       .attr("stroke-width", 1.5)
// //       .attr("d", line);

// //     // Draw Points (No scaling changes)
// //     svg.selectAll("circle")
// //       .data(projectedData)
// //       .enter()
// //       .append("circle")
// //       .attr("cx", d => d.x)
// //       .attr("cy", d => d.t)
// //       .attr("r", d => 3 * d.scale)
// //       .attr("fill", d => d3.interpolateCool(d.scale));

// //   }, [drawData]);

// //   return (
// //     <div className="flex justify-start items-start mt-[-170px]">
// //       <svg ref={svgRef} width={600} height={400} style={{ background: "transparent", display: "block" }}></svg>
// //     </div>
// //   );
// // };

// // export default Spiral3D;


