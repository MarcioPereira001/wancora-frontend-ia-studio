import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY || ''; // In a real app, handled via env vars
  // Defensive coding: If no key, we might return null or handle gracefully in UI
  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be simulated.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSmartReply = async (
  conversationHistory: string,
  tone: 'professional' | 'casual' | 'sales' = 'professional'
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) {
    return "AI Configuration Missing: Please set your API Key.";
  }

  const systemPrompt = `
    You are an expert sales and support assistant inside a CRM.
    Your goal is to suggest a response to the last message in the conversation.
    Tone: ${tone}.
    Keep it concise (under 50 words) and actionable.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: conversationHistory,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingBudget: 0 } // Speed over depth for chat replies
      }
    });
    return response.text || "Could not generate reply.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating AI response. Please try again.";
  }
};

export const refineAgentPrompt = async (currentPrompt: string): Promise<string> => {
   const ai = getAiClient();
   if (!ai) return currentPrompt;

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-3-flash-preview',
       contents: `Optimize the following system prompt for an AI sales agent to be more persuasive and clear: "${currentPrompt}"`,
     });
     return response.text || currentPrompt;
   } catch (e) {
     return currentPrompt;
   }
};