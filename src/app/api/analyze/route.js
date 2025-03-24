export const config = {
    runtime: "nodejs",
};

import { NextResponse } from "next/server";

  export async function POST(req) {
      try {
          const body = await req.json();
          console.log("Received drawData:", JSON.stringify(body));
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1000000);
  
          
          const externalResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify(body),
              signal: controller.signal,
          });
          clearTimeout(timeout);
          const responseText = await externalResponse.text();
          console.log("External API Response(Route page):", responseText);

        let externalApiData;
        try {
            externalApiData = JSON.parse(responseText);
        } catch {
            externalApiData = { rawResponse: responseText };
        }

        // ✅ Step 2: Return the API result to `machine/page.js` (no saving here)
        return NextResponse.json({
            message: "Data sent to external API successfully!",
            result: externalApiData,
        });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ message: "Server Error: Failed to process data" }, { status: 500 });
    }
}


// export const config = {
//     runtime: "nodejs",
//   };
//   import { NextResponse } from "next/server";

//   export async function POST(req) {
//       try {
//           const body = await req.json();
//           console.log("Received drawData:", JSON.stringify(body));
//           const controller = new AbortController();
//           const timeout = setTimeout(() => controller.abort(), 1000000);
  
          
//           const externalResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               credentials: "same-origin",
//               body: JSON.stringify(body),
//               signal: controller.signal,
//           });
//           clearTimeout(timeout);
//           const responseText = await externalResponse.text();
//           console.log("External API Response(Route page):", responseText);
  
//           let externalApiData;
//           try {
//               externalApiData = JSON.parse(responseText); 
//           } catch {
//               externalApiData = { rawResponse: responseText };
//           }
  
//           return NextResponse.json({
//               message: "Data sent to external API successfully!",
//               result: externalApiData,
//           });
//       } catch (error) {
//           console.error("Server Error:", error);
//           return NextResponse.json({ message: "Server Error: Failed to process data" }, { status: 500 });
//       }
//   }


// //BELOW IS THE TRYING TO TEST THE ROUTE TO THE EXTERNAL API AS I FACE SOME DIFFICULTIES GETTING THE SPIRAL API
// // export async function POST(req){
// //     try{
// //         const body = await req.json()
// //         const processedBody = JSON.stringify(body);
// //         let extertnalResponse;
// //         let clockResponse;
// //         try{
// //         extertnalResponse = await fetch('https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral',{
// //             method:'POST',
// //             headers: {'Content-Type':'application/json'},
// //             body: JSON.stringify(processedBody)
// //         })
// //         const responseText = await externalResponse.text();
// //         console.log("External API Raw Response:", responseText);
// //         const externalApiData = await externalResponse.json();
// //         console.log("External API Response:", externalApiData);
// //         return NextResponse.json({message:'received' },{result:externalApiData});

// //         }catch(error){
// //         console.log("huh")
// //         return NextResponse.json({message:'error'},{status:'504'});
// //         }
    
// //     // try{
// //             clockResponse = await fetch('https://eor3nmre1ee4cer.m.pipedream.net',{
// //                 method: "POST",
// //                 headers: {'Content-Type':'application/json'},
// //                 body: JSON.stringify(processed2)
// //             })
// //             return NextResponse.json({message:'external works111'
// //             });
// //     // }catch(error){
// //     //         console.log(error);
// //     // }
    
// //     }catch(error){
// //         console.log(error);
// //     }
// // }


