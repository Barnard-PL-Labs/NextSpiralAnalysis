export const config = {
    runtime: "nodejs",
    maxDuration: 300,
  };
  
export async function POST(req) {
    try {
        const body = await req.json();
        console.log("Received drawData:", JSON.stringify(body, null, 2));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // ✅ 60s timeout

        let externalApiResponse;
        try {
            externalApiResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal, // ✅ Ensure fetch is aborted on timeout
            });

            clearTimeout(timeout);

        } catch (fetchError) {
            if (fetchError.name === "AbortError") {
                console.error("TIMEOUT ERROR: External API took too long to respond!");
                return NextResponse.json({ message: "TIMEOUT ERROR: External API did not respond in time" }, { status: 504 });
            }
            throw fetchError;
        }

        const responseText = await externalApiResponse.text();
        console.log("Raw Response from External API:", responseText);

        let externalApiData;
        try {
            externalApiData = JSON.parse(responseText);
            console.log("Parsed JSON Response from External API:", externalApiData);
        } catch (jsonError) {
            console.warn("EXTERNAL API returned plain text instead of JSON");
            externalApiData = { rawResponse: responseText };
        }

        return NextResponse.json({
            message: "Data sent to external API successfully!",
            externalApiResponse: externalApiData,
        });

    } catch (error) {
        console.error("SERVER ERROR:", error);
        return NextResponse.json({ message: "SERVER ERROR: Failed to process data" }, { status: 500 });
    }
}















// import { NextResponse } from "next/server";

// export async function POST(req) {
//     try {
//         const body = await req.json();
//         console.log("Received drawData:", JSON.stringify(body, null, 2));

//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 300000);

//         let externalApiResponse;
//         try {
//             externalApiResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(body),
//                 signal: controller.signal,
//             });

//             clearTimeout(timeout);

//         } catch (fetchError) {
//             if (fetchError.name === "AbortError") {
//                 console.error("TIMEOUT ERROR: External API took too long to respond!");
//                 return NextResponse.json({ message: "TIMEOUT ERROR: External API did not respond in time" }, { status: 504 });
//             }
//             throw fetchError;
//         }

//         if (!externalApiResponse) {
//             return NextResponse.json({ message: "External API did not return a response" }, { status: 500 });
//         }

//         const responseText = await externalApiResponse.text();
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
