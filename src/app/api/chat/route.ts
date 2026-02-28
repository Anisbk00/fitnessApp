import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// AI Coach Chat API with conversation history
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      message, 
      history = [], 
      coachingTone = "supportive",
      context = {}
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // Build system prompt based on coaching tone
    const tonePrompts: Record<string, string> = {
      strict: `You are a direct, data-focused fitness coach. Provide clear targets and specific feedback. Be concise and avoid unnecessary encouragement. Focus on numbers, metrics, and actionable steps.`,
      supportive: `You are an encouraging, empathetic fitness coach. Balance data insights with positive reinforcement. Celebrate small wins while guiding improvement. Be warm but still provide concrete advice.`,
      minimal: `You are a minimal, essential-only fitness assistant. Provide brief updates and only respond when there's important information. No small talk or excessive explanation. Just the facts.`
    };

    const systemPrompt = `${tonePrompts[coachingTone] || tonePrompts.supportive}

CONTEXT ABOUT THE USER:
- Current goals: ${context.goals || "Not specified"}
- Activity level: ${context.activityLevel || "Not specified"}
- Recent progress: ${context.recentProgress || "Not available"}

GUIDELINES:
1. Always include confidence levels when making estimates (0-100%)
2. Phrase actions as experiments: "Try: [specific action] for [timeframe]"
3. Be factual and non-judgmental
4. If uncertain, clearly state the uncertainty
5. Every insight should have a provenance explanation
6. Keep responses concise (2-3 paragraphs max)
7. End with ONE specific, testable next action when appropriate`;

    // Build messages array
    const messages = [
      { role: "assistant" as const, content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      })),
      { role: "user" as const, content: message }
    ];

    const response = await zai.chat.completions.create({
      model: "default",
      messages,
      thinking: { type: "disabled" }
    });

    const assistantMessage = response.choices[0]?.message?.content;

    // Generate confidence for the response
    const confidence = context.goals && context.activityLevel ? 85 : 65;

    const result = {
      message: assistantMessage,
      confidence,
      provenance: {
        source: "model",
        modelName: "Progress Coach AI",
        timestamp: new Date().toISOString(),
        coachingTone,
        contextUsed: Object.keys(context).length > 0
      }
    };

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Chat failed" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "AI Coach Chat API",
    coachingTones: ["strict", "supportive", "minimal"],
    usage: "POST with { message: string, history?: array, coachingTone?: string, context?: object }"
  });
}
