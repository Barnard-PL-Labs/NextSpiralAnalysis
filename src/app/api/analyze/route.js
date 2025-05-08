import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        const body = await req.json();
        console.log("Received drawData:", JSON.stringify(body));
        console.log("Number of points:", body.length);

        const externalResponse = await fetch("https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(body),
        });
        
        console.log("External API Status:", externalResponse.status);
        const responseText = await externalResponse.text();
        console.log("External API Response(Route page):", responseText);

        let externalApiData;
        try {
            externalApiData = JSON.parse(responseText);
            console.log("Parsed API data:", externalApiData);
        } catch (error) {
            console.error("Error parsing API response:", error);
            externalApiData = { rawResponse: responseText };
        }

        return NextResponse.json({
            message: "Data sent to external API successfully!",
            result: externalApiData,
        });
    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ 
            message: "Server Error: Failed to process data",
            error: error.message 
        }, { status: 500 });
    }
}





