import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// Morph Memory Image Generation API
// IMPORTANT: Generated images must ALWAYS be labeled as "AI Generated"
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      startImageUrl, 
      endImageUrl,
      progressPercentage = 50,
      userId
    } = body;

    if (!startImageUrl || !endImageUrl) {
      return NextResponse.json(
        { error: "Both startImageUrl and endImageUrl are required" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // First, analyze both images to understand the transformation
    const analysisPrompt = `Analyze these two fitness progress photos. The first image is the "before" and the second is "after".

Describe the key physical changes visible between these photos in detail. Focus on:
1. Body composition changes (muscle definition, body fat levels)
2. Posture and form changes
3. Any other visible differences

Be specific and objective.`;

    const analysisResponse = await zai.chat.completions.createVision({
      model: "default",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            { type: "image_url", image_url: { url: startImageUrl } },
            { type: "image_url", image_url: { url: endImageUrl } }
          ]
        }
      ],
      thinking: { type: "disabled" }
    });

    const changesDescription = analysisResponse.choices[0]?.message?.content;

    // Generate the morph image
    const morphPrompt = `Create a realistic fitness progress photo showing approximately ${progressPercentage}% of the transformation between these states:

Changes to show: ${changesDescription}

Requirements:
- The person should look like they are at the ${progressPercentage}% progress point
- Maintain natural, realistic appearance
- Same pose and lighting as the original photos
- Professional quality fitness progress photo
- This is for fitness tracking motivation purposes`;

    const imageResponse = await zai.images.generations.create({
      prompt: morphPrompt,
      size: "768x1344"
    });

    const imageBase64 = imageResponse.data[0].base64;
    const morphImageUrl = `data:image/png;base64,${imageBase64}`;

    // Create the response with mandatory AI labeling
    const result = {
      success: true,
      morphImageUrl,
      progressPercentage,
      
      // MANDATORY: All generated images must be labeled
      isGenerated: true,
      generatedLabel: "AI Generated",
      disclaimer: "This is an AI-generated image for motivational purposes only. It represents an estimated intermediate state and may not reflect actual results.",
      
      provenance: {
        source: "model",
        modelName: "Image Generation Model",
        timestamp: new Date().toISOString(),
        method: "Morph interpolation between progress photos",
        confidence: 65,
        basedOn: ["startImageUrl", "endImageUrl"],
        changesAnalyzed: changesDescription
      },
      
      // User controls
      canHide: true,
      canDelete: true,
      optInRequired: true,
      
      userId: userId || null
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("Morph generation error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Morph generation failed" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "Morph Memory Generation API",
    description: "Generate AI intermediate progress photos between two states",
    important: "All generated images are clearly labeled as AI Generated",
    usage: "POST with { startImageUrl: string, endImageUrl: string, progressPercentage?: number, userId?: string }",
    disclaimer: "Generated images are for motivational purposes only and may not reflect actual results"
  });
}
