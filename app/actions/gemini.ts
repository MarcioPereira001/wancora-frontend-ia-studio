
'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

// 🛡️ SECURITY GUARD: Impede execução no Client-Side
if (typeof window !== 'undefined') {
    throw new Error("⚠️ FATAL: Tentativa de executar código de IA no navegador. Esta ação deve ser Server-Side.");
}

// Definição MOCK das Tools para a Simulação (Para o Gemini saber que elas existem)
const MOCK_TOOLS = [
    {
        name: "schedule_meeting",
        description: "Agenda uma reunião ou compromisso no calendário.",
        parameters: {
            type: "OBJECT",
            properties: {
                title: { type: "STRING", description: "Título do evento." },
                dateISO: { type: "STRING", description: "Data e hora ISO 8601." },
            },
            required: ["title", "dateISO"]
        }
    },
    {
        name: "search_files",
        description: "Busca arquivos no drive.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING" }
            },
            required: ["query"]
        }
    }
];

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
                console.warn(`⚠️ [GEMINI SERVER] 503 Detectado. Tentativa ${i + 1} em ${delay}ms`);
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
      model: 'gemini-1.5-flash',
      contents: history,
      config: { systemInstruction: systemPrompt }
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Erro SmartReply:", error);
    return { error: "Falha na IA: " + error.message };
  }
}

export async function optimizePromptAction(currentPrompt: string) {
  try {
    const ai = await getAuthenticatedAI();
    const response = await generateWithRetry(ai.models, {
      model: 'gemini-1.5-flash',
      contents: `Atue como Engenheiro de Prompt Senior. Otimize: "${currentPrompt}"`
    });
    return { text: response.text };
  } catch (error: any) {
    console.error("Erro OptimizePrompt:", error);
    return { error: "Erro ao otimizar: " + error.message };
  }
}

export async function simulateChatAction(history: any[], systemInstruction: string, knowledgeBase: string) {
    try {
        const ai = await getAuthenticatedAI();
        const fullSystemPrompt = `${systemInstruction}\n\n--- CONHECIMENTO SIMULADO ---\n${knowledgeBase}`;

        const response = await generateWithRetry(ai.models, {
            model: 'gemini-1.5-flash',
            contents: history,
            config: {
                systemInstruction: fullSystemPrompt,
                temperature: 0.7,
                maxOutputTokens: 8192,
                tools: [{ functionDeclarations: MOCK_TOOLS }] // Injeta tools mockados
            }
        });

        // 🛡️ TRATAMENTO DE TOOL CALL
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            const args = JSON.stringify(call.args);
            return { 
                text: `[🤖 AÇÃO SIMULADA DO SISTEMA]\nO agente tentou executar: *${call.name}*\nParâmetros: \`\`\`${args}\`\`\`` 
            };
        }

        return { text: response.text };
    } catch (error: any) {
        // Expondo o erro real para o console do servidor e para o frontend (para debug)
        console.error("❌ [SIMULATION ERROR]", error);
        return { text: `[ERRO NA SIMULAÇÃO] ${error.message || 'Erro desconhecido na API Gemini'}` };
    }
}

export async function generateAgentPromptAction(inputs: any) {
    try {
        const ai = await getAuthenticatedAI();
        const metaPrompt = `Crie um System Instruction para um Agente de Vendas. Empresa: ${inputs.companyName}. Produto: ${inputs.product}. Público: ${inputs.audience}. Tom: ${inputs.tone}. Extra: ${inputs.extra}. Responda apenas o prompt.`;

        const response = await generateWithRetry(ai.models, {
            model: 'gemini-1.5-flash',
            contents: metaPrompt
        });
        
        return { text: response.text };
    } catch (error: any) {
        console.error("Erro GeneratePrompt:", error);
        return { error: "Falha ao gerar prompt: " + error.message };
    }
}
