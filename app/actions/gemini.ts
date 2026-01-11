'use server';

import { GoogleGenAI } from "@google/genai";

// A chave deve vir exclusivamente do ambiente, sem fallbacks manuais no código.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSmartReplyAction(history: string, tone: string = 'professional') {
  const systemPrompt = `
    Você é um assistente especialista em vendas e suporte dentro de um CRM (Wancora).
    Seu objetivo é sugerir uma resposta para a última mensagem da conversa.
    Idioma da resposta: Português Brasileiro (PT-BR).
    Tom: ${tone}.
    Mantenha conciso (menos de 50 palavras) e acionável.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: history,
      config: { systemInstruction: systemPrompt }
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Server Action AI Error:", error);
    return { error: "Falha ao processar IA. Verifique a API Key." };
  }
}

export async function optimizePromptAction(currentPrompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Atue como um Engenheiro de Prompt Senior. Otimize a seguinte instrução de sistema para um agente de vendas IA ser mais persuasivo, seguro e claro. Mantenha em Português Brasileiro. Retorne APENAS o prompt otimizado, sem explicações: "${currentPrompt}"`
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Optimize Prompt Error:", error);
    return { error: "Erro ao otimizar prompt." };
  }
}

export async function simulateChatAction(history: any[], systemInstruction: string, knowledgeBase: string) {
    const fullSystemPrompt = `
    ${systemInstruction}
    
    --- BASE DE CONHECIMENTO ---
    ${knowledgeBase}
    ---------------------------
    
    Diretrizes:
    1. Responda apenas com base no conhecimento fornecido se a pergunta for específica.
    2. Se não souber, diga que vai transferir para um humano.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: history, // Array of parts { role, parts: [{ text }] } handled by caller logic mapping
            config: {
                systemInstruction: fullSystemPrompt,
                temperature: 0.7,
            }
        });
        return { text: response.text };
    } catch (error: any) {
        return { text: `Erro no servidor: ${error.message}` };
    }
}