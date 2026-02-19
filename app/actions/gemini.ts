
'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";

// 🛡️ SECURITY GUARD
if (typeof window !== 'undefined') {
    throw new Error("⚠️ FATAL: Tentativa de executar código de IA no navegador.");
}

// Configuração MOCK para Simulador
const SIMULATOR_TOOLS = {
    functionDeclarations: [
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
    ]
};

// --- HELPER DE RETRY (Anti-429) ---
const generateWithRetry = async (modelInstance: any, prompt: any, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await modelInstance.generateContent(prompt);
        } catch (error: any) {
            const msg = error.message || '';
            const status = error.status || 0;
            
            if (msg.includes('429') || status === 429 || msg.includes('503')) {
                if (i === retries - 1) throw error;
                const delay = 2000 * Math.pow(2, i);
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

    return new GoogleGenerativeAI(apiKey);
};

export async function generateSmartReplyAction(history: string, tone: string = 'professional') {
  try {
    const genAI = await getAuthenticatedAI();
    const systemPrompt = `Você é um assistente CRM. Responda em PT-BR. Tom: ${tone}. Conciso.`;
    
    // FIX: Modelo 2.5 Flash (Production Ready)
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt 
    });
    
    const result = await generateWithRetry(model, history);
    return { text: result.response.text() };
  } catch (error: any) {
    console.error("Erro SmartReply:", error);
    return { error: "Falha na IA: " + error.message };
  }
}

export async function optimizePromptAction(currentPrompt: string) {
  try {
    const genAI = await getAuthenticatedAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await generateWithRetry(model, `Atue como Engenheiro de Prompt Senior. Melhore e estrutura o seguinte prompt para um agente de vendas: "${currentPrompt}"`);
    return { text: result.response.text() };
  } catch (error: any) {
    return { error: "Erro ao otimizar: " + error.message };
  }
}

export async function simulateChatAction(history: any[], systemInstruction: string, knowledgeBase: string) {
    try {
        const genAI = await getAuthenticatedAI();
        const fullSystemPrompt = `${systemInstruction}\n\n--- CONHECIMENTO SIMULADO (RAG) ---\n${knowledgeBase}`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash', // FIX: Modelo Atualizado
            systemInstruction: fullSystemPrompt,
            tools: [SIMULATOR_TOOLS as any]
        });

        // Adapta o histórico para o formato do SDK estável
        const chatHistory = history.map((h: any) => ({
            role: h.role === 'assistant' ? 'model' : h.role,
            parts: h.parts
        }));

        const lastMsg = chatHistory.pop();
        
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000
            }
        });

        const result = await chat.sendMessage(lastMsg?.parts[0]?.text || "");
        const response = result.response;
        
        // Verifica function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const args = JSON.stringify(call.args);
            return { 
                text: `[🤖 AÇÃO DO SISTEMA]\nO agente executou: *${call.name}*\nDados: \`\`\`${args}\`\`\`` 
            };
        }

        return { text: response.text() };

    } catch (error: any) {
        console.error("❌ [SIMULATION ERROR]", error);
        
        let errorMsg = error.message || 'Erro na API Gemini';
        if (errorMsg.includes('404')) errorMsg = 'Modelo não encontrado. Verifique se sua API Key tem acesso ao gemini-2.5-flash.';
        if (errorMsg.includes('429')) errorMsg = 'Cota excedida. Verifique o faturamento no Google Cloud.';

        return { text: `[ERRO TÉCNICO] ${errorMsg}` };
    }
}

export async function generateAgentPromptAction(inputs: any) {
    try {
        const genAI = await getAuthenticatedAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const metaPrompt = `Crie um System Instruction para um Agente de Vendas. Empresa: ${inputs.companyName}. Produto: ${inputs.product}. Público: ${inputs.audience}. Tom: ${inputs.tone}. Extra: ${inputs.extra}. Responda apenas o prompt.`;

        const result = await generateWithRetry(model, metaPrompt);
        
        return { text: result.response.text() };
    } catch (error: any) {
        return { error: "Falha ao gerar prompt: " + error.message };
    }
}
