export const config = {
    runtime: "nodejs",
  };
  import { NextResponse } from "next/server";


  export async function POST(req) {

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 360000);
          const body = await req.json();
          console.log("✅ Received JSON Data:", body);
          console.log("🔍 Timeout limit:", process.env.VERCEL_TIMEOUT_MS || "No limit in local VS Code");
  
        //   const processedData = JSON.stringify(body);
  
          const externalResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: body,
              signal: controller.signal,
          });
          clearTimeout(timeout);
  
          const responseText = await externalResponse.text();
          let externalApiData;
          try {
              externalApiData = JSON.parse(responseText);
          } catch (jsonError) {
              console.warn("⚠️ External API returned plain text");
              externalApiData = { rawResponse: responseText };
          }
  
          console.log("✅ External API Response:", externalApiData);
  
          // ✅ Send logs back to frontend for debugging
          return NextResponse.json({
              message: "✅ Data sent successfully!",
              sentData: body, // Shows data sent
              receivedResponse: externalApiData // Shows API response
          });
  
      } catch (error) {
          console.error("❌ SERVER ERROR:", error);
          return NextResponse.json({
              message: "❌ SERVER ERROR: Failed to process data",
              error: error.toString(),
          }, { status: 500 });
      }
  }
  
// export async function POST(req) {
//     try {
//         const body = await req.json();
//         console.log("Received drawData:", JSON.stringify(body));
//         const processBody = JSON.stringify(body);
//         console.log('procesd', processBody);

//         let externalApiResponse;
//         try {
//             externalApiResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(body),
//             });


//         } catch (fetchError) {
//             if (fetchError.name === "AbortError") {
//                 console.error("TIMEOUT ERROR: External API took too long to respond!");
//                 return NextResponse.json({ message: "TIMEOUT ERROR: External API did not respond in time" }, { status: 504 });
//             }
//             throw fetchError;
//         }

//         const responseText = await externalApiResponse.json();
//         console.log("Raw Response from External API:", responseText);

//         let externalApiData;
//         try {
//             externalApiData = JSON.parse(responseText);
//             console.log("Parsed JSON Response from External API:", externalApiData);
//         } catch (jsonError) {
//             console.warn("EXTERNAL API returned plain text instead of JSON");
//             externalApiData = { rawResponse: responseText };
//         }

//         return NextResponse.json({
//             message: "Data sent to external API successfully!",
//             externalApiResponse: externalApiData,
//         });

//     } catch (error) {
//         console.error("SERVER ERROR:", error);
//         return NextResponse.json({ message: "SERVER ERROR: Failed to process data" }, { status: 500 });
//     }
// }


//BELOW IS THE TRYING TO TEST THE ROUTE TO THE EXTERNAL API AS I FACE SOME DIFFICULTIES GETTING THE SPIRAL API
// export async function POST(req){
//     try{
//         const body = await req.json()
//         const processedBody = JSON.stringify(body);
//         const processed2=JSON.stringify(processedBody);
//         let extertnalResponse;
//         let clockResponse;
//     try{
//         extertnalResponse = await fetch('https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral',{
//             method:'POST',
//             headers: {'Content-Type':'application.json'},
//             body: JSON.stringify(processed2)
//         })
//         const responseText = await externalResponse.text();
//         console.log("📡 External API Raw Response:", responseText);
//         const externalApiData = await externalResponse.json();
//         console.log("✅ External API Response:", externalApiData);
//         return NextResponse.json({message:'received' },{result:externalApiData});

//     }catch(error){
//         console.log("huh")
//         return NextResponse.json({message:'error'});
//     }
    
//     // try{
    //         clockResponse = await fetch('https://eor3nmre1ee4cer.m.pipedream.net',{
    //             method: "POST",
    //             headers: {'Content-Type':'application/json'},
    //             body: JSON.stringify(processed2)
    //         })
    //         return NextResponse.json({message:'external works111'
    //         });
    // }catch(error){
    //         console.log(error);
    // }
    
//     }catch(error){
//         console.log(error);
//     }
// }


