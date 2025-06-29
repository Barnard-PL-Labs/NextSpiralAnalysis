import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("User: ", body.user);
    console.log("Received drawData length:", body.drawData.length);

    // Validate input data
    if (!Array.isArray(body.drawData) || body.drawData.length === 0) {
      console.error("Invalid draw data received:", body.drawData);
      return NextResponse.json(
        {
          message: "Invalid draw data",
          error: "Draw data must be a non-empty array",
        },
        { status: 400 }
      );
    }
    console.log("Sending to external API:", {
      pointCount: body.drawData.length,
      firstPoint: body.drawData[0],
      lastPoint: body.drawData[body.drawData.length - 1],
      dataType: typeof body.drawData,
      isArray: Array.isArray(body.drawData),
      serializedSize: JSON.stringify(body.drawData).length,
    });

    try {
      const externalResponse = await fetch(
        "https://spiral-qihf6vxbsq-ue.a.run.app/run_spiral",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body.drawData),
        }
      );

      console.log("External API Status:", externalResponse.status);
      console.log("External API Status Text:", externalResponse.statusText);

      if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        console.error("External API Error Response:", {
          status: externalResponse.status,
          statusText: externalResponse.statusText,
          errorBody: errorText,
          requestData: body.drawData.slice(0, 5),
        });
        return NextResponse.json(
          {
            message: "External API Error",
            error: `${externalResponse.status} ${externalResponse.statusText}: ${errorText}`,
          },
          { status: externalResponse.status }
        );
      }

      let responseText;
      try {
        responseText = await externalResponse.text();
        console.log("Raw External API Response:", responseText);

        if (!responseText.trim()) {
          throw new Error("Empty response from external API");
        }

        const externalApiData = JSON.parse(responseText);
        console.log("=== EXTERNAL API RESPONSE ANALYSIS ===");
        console.log("Response type:", typeof externalApiData);
        console.log("Is array:", Array.isArray(externalApiData));
        console.log("Response keys:", Object.keys(externalApiData));
        console.log(
          "Response structure:",
          JSON.stringify(externalApiData, null, 2)
        );

        // Check if it has nested objects/arrays
        Object.keys(externalApiData).forEach((key) => {
          const value = externalApiData[key];
          console.log(`Property "${key}":`, {
            type: typeof value,
            isArray: Array.isArray(value),
            length: value?.length || "N/A",
            keys:
              typeof value === "object" && value !== null
                ? Object.keys(value)
                : "N/A",
          });
        });
        console.log("Parsed External API Response:", externalApiData);

        if (!externalApiData || typeof externalApiData !== "object") {
          throw new Error("Invalid response format from external API");
        }

        return NextResponse.json({
          message: "Analysis completed successfully",
          result: externalApiData,
        });
      } catch (parseError) {
        console.error("Error parsing API response:", parseError);
        console.error("Raw response was:", responseText);
        return NextResponse.json(
          {
            message: "Failed to parse external API response",
            error: parseError.message,
            rawResponse: responseText,
          },
          { status: 500 }
        );
      }
    } catch (fetchError) {
      console.error("Error fetching from external API:", fetchError);
      return NextResponse.json(
        {
          message: "Failed to communicate with external API",
          error: fetchError.message,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      {
        message: "Server Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
