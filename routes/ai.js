// ─────────────────────────────────────────────────────────────
//  routes/ai.js  —  AI-powered endpoints using Gemini 1.5 Flash
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// ── Default fallbacks ───────────────────────────────────────

function getDefaultRecommendations(severity) {
  if (severity === "Low") {
    return [
      "Rest and monitor your symptoms at home",
      "Stay hydrated and maintain proper nutrition",
      "Take over-the-counter medication if appropriate",
      "Schedule a routine appointment if symptoms persist beyond 48 hours",
    ];
  } else if (severity === "High") {
    return [
      "Seek immediate medical attention",
      "Consider visiting an emergency room",
      "Do not drive yourself - arrange for transportation",
      "Bring a list of your symptoms and medications",
    ];
  }
  return [
    "Consider seeing a healthcare provider today",
    "Monitor your symptoms for any changes",
    "Rest and avoid strenuous activities",
    "Keep track of symptom progression",
  ];
}

function getDefaultAnalysis() {
  return "Based on your responses, we recommend consulting with a healthcare provider for proper evaluation. Your symptoms should be assessed by a medical professional to ensure appropriate care.";
}

// ── Triage Analysis ─────────────────────────────────────────

router.post("/triage-analysis", async (req, res) => {
  try {
    const { questions, calculatedSeverity, totalScore, maxScore } = req.body;

    const questionsText = questions
      .map((q, i) => `${i + 1}. ${q.question}\n   Answer: ${q.answer}`)
      .join("\n\n");

    const prompt = `You are a medical triage AI assistant. Based on the following patient assessment responses, provide:
1. A brief analysis of the patient's condition (2-3 sentences)
2. 4 specific recommendations based on the severity level

Patient Assessment Responses:
${questionsText}

Calculated Severity: ${calculatedSeverity}
Symptom Score: ${totalScore} out of ${maxScore}

IMPORTANT: 
- Be professional and empathetic
- Never diagnose specific conditions
- Always recommend consulting a healthcare provider
- Tailor recommendations to the ${calculatedSeverity} severity level

Respond in JSON format:
{
  "analysis": "Your analysis here...",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3", "Recommendation 4"]
}`;

    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsedResponse;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      parsedResponse = {
        analysis: text,
        recommendations: getDefaultRecommendations(calculatedSeverity),
      };
    }

    res.json({
      analysis: parsedResponse.analysis,
      recommendations: parsedResponse.recommendations,
    });
  } catch (error) {
    console.error("Triage analysis error:", error);
    res.json({
      analysis: getDefaultAnalysis(),
      recommendations: getDefaultRecommendations("Moderate"),
    });
  }
});

// ── Analyze Report (Chat) ───────────────────────────────────

router.post("/analyze-report", async (req, res) => {
  try {
    const { messages = [] } = req.body;

    const systemPrompt = `You are a helpful medical AI assistant. Your role is to analyze medical reports and provide helpful information about potential precautions and general health suggestions.

IMPORTANT DISCLAIMERS:
- You are NOT a licensed medical professional
- Your suggestions are for informational purposes only
- Always recommend consulting with a qualified healthcare provider
- Never prescribe specific medications or dosages
- Focus on general wellness advice, lifestyle recommendations, and when to seek professional help

When analyzing reports, provide:
1. A brief summary of what you observe in the report
2. General health precautions based on the findings
3. Lifestyle and wellness suggestions
4. Clear recommendation to consult with a doctor for proper diagnosis and treatment

Be empathetic, clear, and helpful while maintaining appropriate medical boundaries.`;

    // Build conversation history for Gemini
    const chatHistory = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || "Hello";

    const model = getModel();
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "System: " + systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I will act as a medical AI assistant following those guidelines. How can I help you today?" }] },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    res.json({ role: "assistant", content: text });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Analysis failed" });
  }
});

export default router;
