
'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

// Factory para obter cliente autenticado com a chave correta (Tenant ou Global)
const getAuthenticatedAI = async () => {
    const supabase = await createClient();
    
    // 1. Tenta obter usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    
    let apiKey = process.env.API_KEY; // Fallback Global

    if (user?.id) {
        // 2. Se tem usuário, busca a config da empresa
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

        if (profile?.company_id) {
            const { data: company } = await supabase
                .from('companies')
                .select('ai_config')
                .eq('id', profile.company_id)
                .single();
            
            if (company?.ai_config?.apiKey) {
                apiKey = company.ai_config.apiKey;
            }
        }
    }

    if (!apiKey) {
        throw new Error("Nenhuma API Key de IA configurada (Sistema ou Empresa).");
    }

    return new GoogleGenAI({ apiKey });
};

export async function generateSmartReplyAction(history: string, tone: string = 'professional') {
  try {
    const ai = await getAuthenticatedAI();
    
    const systemPrompt = `
      Você é um assistente especialista em vendas e suporte dentro de um CRM (Wancora).
      Seu objetivo é sugerir uma resposta para a última mensagem da conversa.
      Idioma da resposta: Português Brasileiro (PT-BR).
      Tom: ${tone}.
      Mantenha conciso (menos de 50 palavras) e acionável.
    `;

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
    const ai = await getAuthenticatedAI();

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
    try {
        const ai = await getAuthenticatedAI();

        const fullSystemPrompt = `
        ${systemInstruction}
        
        --- BASE DE CONHECIMENTO ---
        ${knowledgeBase}
        ---------------------------
        
        Diretrizes:
        1. Responda apenas com base no conhecimento fornecido se a pergunta for específica.
        2. Se não souber, diga que vai transferir para um humano.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: history,
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
