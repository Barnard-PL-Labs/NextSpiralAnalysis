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

        //Send the Response back
        return NextResponse.json({
            message: "Data sent to external API successfully!",
            result: externalApiData,
        });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ message: "Server Error: Failed to process data" }, { status: 500 });
    }
}





