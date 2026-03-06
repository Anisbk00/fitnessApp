import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// ═══════════════════════════════════════════════════════════════
// LLM Numeric Validation Guardrails
// ═══════════════════════════════════════════════════════════════

/**
 * Reasonable bounds for fitness-related metrics to prevent hallucinated numbers
 */
const FITNESS_BOUNDS = {
  weight: { min: 30, max: 300, unit: 'kg' },
  weightLoss: { min: 0, max: 2, unit: 'kg/week' },
  weightGain: { min: 0, max: 1, unit: 'kg/week' },
  bodyFat: { min: 3, max: 50, unit: '%' },
  calories: { min: 1000, max: 5000, unit: 'kcal' },
  protein: { min: 20, max: 400, unit: 'g' },
  carbs: { min: 20, max: 800, unit: 'g' },
  fat: { min: 10, max: 200, unit: 'g' },
  water: { min: 1, max: 8, unit: 'L' },
  sleep: { min: 4, max: 12, unit: 'hours' },
  heartRate: { min: 40, max: 220, unit: 'bpm' },
  workoutDuration: { min: 5, max: 300, unit: 'minutes' },
  sets: { min: 1, max: 50, unit: 'sets' },
  reps: { min: 1, max: 100, unit: 'reps' },
  weightLifted: { min: 1, max: 500, unit: 'kg' },
};

/**
 * Validate a numeric value against expected bounds
 */
function validateNumericValue(value: number, type: keyof typeof FITNESS_BOUNDS): { 
  valid: boolean; 
  value: number; 
  warning?: string;
} {
  const bounds = FITNESS_BOUNDS[type];
  if (!bounds) {
    return { valid: true, value };
  }

  if (value < bounds.min || value > bounds.max) {
    const warning = `Value ${value} ${bounds.unit} for ${type} seems unrealistic (expected ${bounds.min}-${bounds.max} ${bounds.unit}). This may be an AI estimation error.`;
    // Clamp to reasonable bounds
    const clampedValue = Math.max(bounds.min, Math.min(bounds.max, value));
    return { valid: false, value: clampedValue, warning };
  }

  return { valid: true, value };
}

/**
 * Extract and validate numbers from LLM response
 */
function validateNumbersInResponse(content: string): { 
  content: string; 
  warnings: string[];
  flaggedNumbers: Array<{ original: number; type: string; warning?: string }>;
} {
  const warnings: string[] = [];
  const flaggedNumbers: Array<{ original: number; type: string; warning?: string }> = [];

  // Common patterns for fitness metrics in responses
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)/gi, type: 'weight' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:body\s*fat|bf)/gi, type: 'bodyFat' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:kcal|calories?)/gi, type: 'calories' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s*)?(?:protein|proteins)/gi, type: 'protein' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s*)?(?:carbs|carbohydrates)/gi, type: 'carbs' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:g|grams?)\s*(?:of\s*)?(?:fat|fats)/gi, type: 'fat' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/gi, type: 'sleep' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:bpm|beats?\s*per\s*minute)/gi, type: 'heartRate' as const },
    { regex: /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\s*(?:workout|exercise|training)/gi, type: 'workoutDuration' as const },
  ];

  let validatedContent = content;

  for (const { regex, type } of patterns) {
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const numValue = parseFloat(match[1]);
      if (!isNaN(numValue)) {
        const validation = validateNumericValue(numValue, type);
        if (!validation.valid) {
          warnings.push(validation.warning!);
          flaggedNumbers.push({ original: numValue, type, warning: validation.warning });
        }
      }
    }
  }

  return { content: validatedContent, warnings, flaggedNumbers };
}

// ═══════════════════════════════════════════════════════════════
// AI Coach Chat API
// ═══════════════════════════════════════════════════════════════
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

    // Validate numbers in the LLM response to catch hallucinations
    const validation = validateNumbersInResponse(assistantMessage || "");

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
      },
      // Include validation warnings if any numbers were flagged
      ...(validation.warnings.length > 0 && {
        validationWarnings: validation.warnings,
        flaggedNumbers: validation.flaggedNumbers
      })
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
