import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  // API Key must be obtained exclusively from process.env.API_KEY
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
      console.warn("Gemini API Key missing (process.env.API_KEY). Simulation mode active.");
      return null;
  }

  return new GoogleGenAI({ apiKey });
};

export const generateSmartReply = async (
  conversationHistory: string,
  tone: 'professional' | 'casual' | 'sales' = 'professional'
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Olá! Como posso ajudar? (Modo Simulação - Configure sua API Key)";

  const systemPrompt = `
    Você é um assistente especialista em vendas e suporte dentro de um CRM.
    Seu objetivo é sugerir uma resposta para a última mensagem da conversa.
    Idioma da resposta: Português Brasileiro (PT-BR).
    Tom: ${tone}.
    Mantenha conciso (menos de 50 palavras) e acionável.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: conversationHistory,
      config: {
        systemInstruction: systemPrompt,
      }
    });
    return response.text || "Não foi possível gerar a resposta.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao gerar resposta da IA. Tente novamente.";
  }
};

export const refineAgentPrompt = async (currentPrompt: string): Promise<string> => {
   const ai = getAiClient();
   if (!ai) return currentPrompt + " (Simulação)";

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-3-flash-preview', 
       contents: `Atue como um Engenheiro de Prompt Senior. Otimize a seguinte instrução de sistema para um agente de vendas IA ser mais persuasivo, seguro e claro. Mantenha em Português Brasileiro. Retorne APENAS o prompt otimizado, sem explicações: "${currentPrompt}"`,
     });
     return response.text || currentPrompt;
   } catch (e) {
     return currentPrompt;
   }
};

export const simulateAgentChat = async (
    history: {role: 'user' | 'model', parts: {text: string}[]}[], 
    systemInstruction: string, 
    knowledgeBase: string
): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "Estou funcionando em modo de simulação (Sem API Key).";

    const fullSystemPrompt = `
    ${systemInstruction}

    --- BASE DE CONHECIMENTO (Use isso para responder) ---
    ${knowledgeBase}
    -----------------------------------------------------

    Diretrizes:
    1. Responda apenas com base no conhecimento fornecido se a pergunta for específica.
    2. Se não souber, diga que vai transferir para um humano.
    3. Mantenha o tom da persona definida.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: history,
            config: {
                systemInstruction: fullSystemPrompt,
                temperature: 0.7,
            }
        });
        return response.text || "...";
    } catch (error: any) {
        console.error("Simulator Error:", error);
        return `Erro na simulação: ${error.message}`;
    }
};