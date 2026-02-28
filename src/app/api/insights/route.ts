import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// Insights Generation API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userData,
      timeframe = "14 days"
    } = body;

    const zai = await ZAI.create();

    const systemPrompt = `You are an expert fitness data analyst. Analyze the provided user data and generate actionable insights.

RULES:
1. Every insight must include a confidence score (0-100)
2. Every insight must have a one-line rationale
3. Actions should be phrased as experiments: "Try: [action] for [timeframe]"
4. Be factual and non-judgmental
5. If data is insufficient, state that clearly

OUTPUT FORMAT (JSON array):
[
  {
    "id": "unique-id",
    "title": "Insight title",
    "description": "Detailed explanation",
    "actionSuggestion": "Try: ...",
    "confidence": 85,
    "category": "trend" | "anomaly" | "correlation" | "prediction",
    "dataSources": ["source1", "source2"],
    "priority": 0-100,
    "rationale": "One-line explanation"
  }
]

Categories:
- trend: Ongoing patterns in the data
- anomaly: Unusual observations that stand out
- correlation: Relationships between different metrics
- prediction: Future projections based on current data`;

    const userPrompt = `Analyze the following fitness data for the past ${timeframe}:

${JSON.stringify(userData, null, 2)}

Generate 3-5 actionable insights. Focus on the most important findings that could help the user improve their fitness journey.`;

    const response = await zai.chat.completions.create({
      model: "default",
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      thinking: { type: "disabled" }
    });

    const content = response.choices[0]?.message?.content;

    // Parse insights
    let insights: Array<Record<string, unknown>>;
    try {
      const jsonMatch = content?.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        insights = [];
      }
    } catch {
      insights = [];
    }

    // Add provenance to each insight
    const insightsWithProvenance = insights.map((insight) => ({
      ...insight,
      generatedAt: new Date().toISOString(),
      provenance: {
        source: "model",
        modelName: "Insight Engine v2",
        dataPointsUsed: insight.dataSources || [],
        method: "Pattern analysis and correlation detection"
      }
    }));

    return NextResponse.json({
      success: true,
      insights: insightsWithProvenance,
      generatedAt: new Date().toISOString(),
      timeframe
    });

  } catch (error) {
    console.error("Insights generation error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Insights generation failed" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "Insights Generation API",
    categories: ["trend", "anomaly", "correlation", "prediction"],
    usage: "POST with { userData: object, timeframe?: string }"
  });
}
