import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// Photo analysis API with confidence bands and provenance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, analysisType = "body-composition" } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    const prompts = {
      "body-composition": `Analyze this fitness progress photo and provide an estimated body composition assessment. 

IMPORTANT: You must respond in JSON format with the following structure:
{
  "bodyFatEstimate": { "value": number, "confidence": number (0-100), "rationale": "string" },
  "muscleMassEstimate": { "value": number, "confidence": number (0-100), "rationale": "string" },
  "weightEstimate": { "value": number, "confidence": number (0-100), "rationale": "string" },
  "overallConfidence": number (0-100),
  "analysisNotes": "string"
}

Provide realistic estimates with appropriate confidence levels.`,
      
      "meal": `Analyze this meal photo and identify the foods. Estimate nutritional content in JSON format.`,
      
      "food-label": `Analyze this nutrition label and extract all information in JSON format.`
    };

    const prompt = prompts[analysisType as keyof typeof prompts] || prompts["body-composition"];

    const response = await zai.chat.completions.createVision({
      model: "default",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: { type: "disabled" }
    });

    const content = response.choices[0]?.message?.content;
    
    // Parse the JSON response
    let analysisResult: Record<string, unknown>;
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        analysisResult = { rawResponse: content };
      }
    } catch {
      analysisResult = { rawResponse: content };
    }

    // Add provenance metadata
    const result = {
      ...analysisResult,
      _provenance: {
        source: "model",
        modelName: "Vision Language Model v2",
        timestamp: new Date().toISOString(),
        analysisType,
        processingTime: Date.now()
      }
    };

    return NextResponse.json({
      success: true,
      analysis: result
    });

  } catch (error) {
    console.error("Photo analysis error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Analysis failed" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "Photo Analysis API",
    analysisTypes: ["body-composition", "meal", "food-label"],
    usage: "POST with { imageUrl: string, analysisType?: string }"
  });
}
