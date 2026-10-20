import { NextResponse } from "next/server";
import { computeWidthMetrics } from "@/lib/widthMetrics";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Received drawData length:", body.drawData.length);

    // Validate input data
    if (!Array.isArray(body.drawData) || body.drawData.length === 0) {
      console.error(
        "Invalid draw data received: expected a non-empty array, got",
        Array.isArray(body.drawData) ? "an empty array" : typeof body.drawData
      );
      return NextResponse.json(
        {
          message: "Invalid draw data",
          error: "Draw data must be a non-empty array",
        },
        { status: 400 }
      );
    }

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

      console.log(
        "External API status:",
        externalResponse.status,
        externalResponse.statusText
      );

      if (!externalResponse.ok) {
        const errorText = await externalResponse.text();
        console.error("External API error response:", {
          status: externalResponse.status,
          statusText: externalResponse.statusText,
          errorBodyLength: errorText.length,
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

        if (!responseText.trim()) {
          throw new Error("Empty response from external API");
        }

        const externalApiData = JSON.parse(responseText);

        if (!externalApiData || typeof externalApiData !== "object") {
          throw new Error("Invalid response format from external API");
        }

        // Compute width metrics in JS and fill any blank values from the backend.
        // MATLAB leaves width fields as "No Axis" when the interp1 bug fires.
        const WIDTH_KEYS = [
          "overall average of widths",
          "std of widths.",
          "COV of width",
          "1st quad average median",
          "2nd quad average median",
          "3rd quad average median",
          "4th quad average median",
        ];
        try {
          const wm = computeWidthMetrics(body.drawData);
          if (wm) {
            WIDTH_KEYS.forEach(k => {
              const existing = externalApiData[k];
              const isBlank = existing == null || existing === "" ||
                (typeof existing === "string" && /^no axis$/i.test(existing.trim()));
              if (isBlank && wm[k] != null) externalApiData[k] = String(wm[k]);
            });
          }
        } catch (wmErr) {
          console.error("JS width metrics failed (non-fatal):", wmErr.message);
        }

        return NextResponse.json({
          message: "Analysis completed successfully",
          result: externalApiData,
        });
      } catch (parseError) {
        console.error(
          "Error parsing external API response:",
          parseError.message,
          "response length:",
          responseText?.length ?? 0
        );
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
      console.error(
        "Error fetching from external API:",
        fetchError.message
      );
      return NextResponse.json(
        {
          message: "Failed to communicate with external API",
          error: fetchError.message,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Server error in analyze route:", error.message);
    return NextResponse.json(
      {
        message: "Server Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
