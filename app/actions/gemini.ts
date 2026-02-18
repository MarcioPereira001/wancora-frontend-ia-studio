
'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

// 🛡️ SECURITY GUARD: Impede execução no Client-Side
if (typeof window !== 'undefined') {
    throw new Error("⚠️ FATAL: Tentativa de executar código de IA no navegador. Esta ação deve ser Server-Side.");
}

// Helper de Retry (Backoff)
const generateWithRetry = async (modelInstance: any, params: any, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await modelInstance.generateContent(params);
        } catch (error: any) {
            const msg = error.message || '';
            const isOverloaded = msg.includes('503') || msg.includes('Overloaded') || error.status === 503;
            
            if (isOverloaded && i < retries - 1) {
                const delay = 1500 * Math.pow(2, i); // 1.5s, 3s, 6s
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
};

const getAuthenticatedAI = async () => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let apiKey = process.env.API_KEY; 

    if (user?.id) {
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
        if (profile?.company_id) {
            const { data: company } = await supabase.from('companies').select('ai_config').eq('id', profile.company_id).single();
            if (company?.ai_config?.apiKey) apiKey = company.ai_config.apiKey;
        }
    }

    if (!apiKey) throw new Error("Nenhuma API Key de IA configurada.");

    return new GoogleGenAI({ apiKey });
};

export async function generateSmartReplyAction(history: string, tone: string = 'professional') {
  try {
    const ai = await getAuthenticatedAI();
    const systemPrompt = `Você é um assistente CRM. Responda em PT-BR. Tom: ${tone}. Conciso.`;
    
    const response = await generateWithRetry(ai.models, {
      model: 'gemini-3-flash-preview',
      contents: history,
      config: { systemInstruction: systemPrompt }
    });
    return { text: response.text };
  } catch (error: any) {
    return { error: "Falha na IA: " + error.message };
  }
}

export async function optimizePromptAction(currentPrompt: string) {
  try {
    const ai = await getAuthenticatedAI();
    const response = await generateWithRetry(ai.models, {
      model: 'gemini-3-flash-preview',
      contents: `Atue como Engenheiro de Prompt Senior. Otimize: "${currentPrompt}"`
    });
    return { text: response.text };
  } catch (error: any) {
    return { error: "Erro ao otimizar." };
  }
}

export async function simulateChatAction(history: any[], systemInstruction: string, knowledgeBase: string) {
    try {
        const ai = await getAuthenticatedAI();
        const fullSystemPrompt = `${systemInstruction}\n\n--- CONHECIMENTO SIMULADO ---\n${knowledgeBase}`;

        const response = await generateWithRetry(ai.models, {
            model: 'gemini-3-flash-preview',
            contents: history,
            config: {
                systemInstruction: fullSystemPrompt,
                temperature: 0.7,
                maxOutputTokens: 8192, 
            }
        });
        return { text: response.text };
    } catch (error: any) {
        return { text: `Erro na simulação: ${error.message}` };
    }
}

export async function generateAgentPromptAction(inputs: any) {
    try {
        const ai = await getAuthenticatedAI();
        const metaPrompt = `Crie um System Instruction para um Agente de Vendas. Empresa: ${inputs.companyName}. Produto: ${inputs.product}. Público: ${inputs.audience}. Tom: ${inputs.tone}. Extra: ${inputs.extra}. Responda apenas o prompt.`;

        const response = await generateWithRetry(ai.models, {
            model: 'gemini-3-flash-preview',
            contents: metaPrompt
        });
        
        return { text: response.text };
    } catch (error: any) {
        return { error: "Falha ao gerar prompt." };
    }
}
