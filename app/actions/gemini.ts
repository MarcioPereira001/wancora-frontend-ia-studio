
'use server';

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

// 🛡️ SECURITY GUARD: Impede execução no Client-Side
if (typeof window !== 'undefined') {
    throw new Error("⚠️ FATAL: Tentativa de executar código de IA no navegador. Esta ação deve ser Server-Side.");
}

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

        // 🧠 AQUI ESTÁ A MUDANÇA: 
        // Removemos o "Meta-Prompt" fixo que forçava brevidade.
        // Agora confiamos 100% no 'systemInstruction' que vem do Frontend (PromptBuilder),
        // pois ele já contém as regras de verbosidade (Minimalista/Padrão/Misto) escolhidas pelo usuário.
        
        const fullSystemPrompt = `
        ${systemInstruction}
        
        --- BASE DE CONHECIMENTO SIMULADA ---
        ${knowledgeBase}
        ---------------------------
        
        IMPORTANTE:
        1. Responda seguindo estritamente as diretrizes de fluxo e tom acima.
        2. Use o conhecimento simulado apenas se a pergunta exigir.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: history,
            config: {
                systemInstruction: fullSystemPrompt,
                temperature: 0.7,
                maxOutputTokens: 300, // Aumentado para permitir respostas "Mistas" ou "Longas" se configurado
            }
        });
        return { text: response.text };
    } catch (error: any) {
        return { text: `Erro no servidor: ${error.message}` };
    }
}

export async function generateAgentPromptAction(inputs: { companyName: string; product: string; audience: string; tone: string; extra: string }) {
    try {
        const ai = await getAuthenticatedAI();
        
        const metaPrompt = `
        Atue como um Engenheiro de Prompt Senior especializado em LLMs para atendimento e vendas no WhatsApp.
        
        Sua tarefa é escrever um "System Instruction" (Prompt de Sistema) para um Agente de IA.
        
        DADOS DA EMPRESA:
        - Nome: ${inputs.companyName}
        - O que vende: ${inputs.product}
        - Público Alvo: ${inputs.audience}
        - Tom de Voz: ${inputs.tone}
        - Informações Extras: ${inputs.extra}
        
        SAÍDA ESPERADA:
        Escreva um texto em primeira pessoa ("Você é...") instruindo a IA sobre como se comportar. 
        Divida em seções: [IDENTIDADE], [OBJETIVO], [DIRETRIZES DE COMUNICAÇÃO].
        
        Não use markdown de código (\`\`\`). Apenas o texto plano.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: metaPrompt
        });
        
        return { text: response.text };
    } catch (error: any) {
        console.error("Generator Error:", error);
        return { error: "Falha ao gerar prompt." };
    }
}
