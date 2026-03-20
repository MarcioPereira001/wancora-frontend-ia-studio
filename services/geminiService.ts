import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SystemLogger } from "@/lib/logger";

// Configuração MOCK para Simulador (Usando as tipagens corretas do novo SDK)
const SIMULATOR_TOOLS: FunctionDeclaration[] = [
    {
        name: "schedule_meeting",
        description: "Agenda uma reunião ou compromisso no calendário.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Título do evento." },
                dateISO: { type: Type.STRING, description: "Data e hora ISO 8601." },
            },
            required: ["title", "dateISO"]
        }
    },
    {
        name: "search_files",
        description: "Busca arquivos no drive.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING }
            },
            required: ["query"]
        }
    }
];

// Inicialização Singleton no Client-Side
const getAIClient = () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key do Gemini não configurada no ambiente.");
    return new GoogleGenAI({ apiKey });
};

// --- HELPER DE RETRY (Anti-429) ---
const generateWithRetry = async (ai: GoogleGenAI, params: any, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await ai.models.generateContent(params);
        } catch (error: any) {
            const msg = error.message || '';
            const status = error.status || 0;
            
            if (msg.includes('429') || status === 429 || msg.includes('503')) {
                SystemLogger.warn(`[Gemini Retry] Tentativa ${i+1}/${retries} falhou. Aguardando...`);
                if (i === retries - 1) throw error;
                const delay = 2000 * Math.pow(2, i);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Max retries reached");
};

export const geminiService = {
    async simulateChat(history: any[], systemInstruction: string, knowledgeBase: string, files: {name: string, url: string, type: string}[] = []) {
        try {
            const ai = getAIClient();
            
            // Regra estrita de proibição de textos em imagens injetada no prompt do sistema
            const strictRules = "\n\n[REGRA ABSOLUTA]: NÃO QUERO NADA ESCRITO nas imagens geradas. Eu não quero nenhum texto, tipografia ou letras.";
            const fullSystemPrompt = `${systemInstruction}\n\n--- CONHECIMENTO SIMULADO (RAG) ---\n${knowledgeBase}${strictRules}`;

            // Processamento de arquivos 100% no navegador (Sem backend)
            const fileParts = await Promise.all(files.map(async (file) => {
                const response = await fetch(file.url);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(blob);
                });
                const mimeType = blob.type || 'text/plain';
                return { inlineData: { data: base64, mimeType } };
            }));

            const formattedHistory = history.map((h: any) => {
                const role = h.role === 'assistant' || h.role === 'model' ? 'Agente' : 'Cliente';
                const text = h.parts?.[0]?.text || h.text || '';
                return `${role}: ${text}`;
            }).join('\n');

            const result = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview', // Modelo mais avançado
                contents: { parts: [...fileParts, { text: formattedHistory }] },
                config: {
                    systemInstruction: fullSystemPrompt,
                    tools: [{ functionDeclarations: SIMULATOR_TOOLS }],
                    temperature: 0.7
                }
            });

            // Verifica function calls no novo formato
            const functionCalls = result.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                const args = JSON.stringify(call.args);
                return { 
                    text: `[🤖 AÇÃO DO SISTEMA]\nO agente executou: *${call.name}*\nDados: \`\`\`${args}\`\`\`` 
                };
            }

            return { text: result.text };

        } catch (error: any) {
            console.error("❌ [SIMULATION ERROR]", error);
            
            let errorMsg = error.message || 'Erro na API Gemini';
            if (errorMsg.includes('404')) errorMsg = 'Modelo não encontrado. Verifique se sua API Key tem acesso ao gemini-3.1-pro-preview.';
            if (errorMsg.includes('429')) errorMsg = 'Cota excedida. Verifique o faturamento no Google Cloud.';

            return { text: `[ERRO TÉCNICO] ${errorMsg}` };
        }
    },

    async generateSmartReply(history: string, tone: string = 'professional') {
        try {
            const ai = getAIClient();
            const systemPrompt = `Você é um assistente CRM. Responda em PT-BR. Tom: ${tone}. Conciso.`;
            
            const result = await generateWithRetry(ai, {
                model: 'gemini-3.1-pro-preview',
                contents: history,
                config: {
                    systemInstruction: systemPrompt
                }
            });
            
            return { text: result.text };
        } catch (error: any) {
            console.error("Erro SmartReply:", error);
            return { error: "Falha na IA: " + error.message };
        }
    },

    async optimizePrompt(currentPrompt: string) {
        try {
            const ai = getAIClient();
            
            const result = await generateWithRetry(ai, {
                model: 'gemini-3.1-pro-preview',
                contents: `Atue como Engenheiro de Prompt Senior. Melhore e estrutura o seguinte prompt para um agente de vendas: "${currentPrompt}"`
            });
            
            return { text: result.text };
        } catch (error: any) {
            return { error: "Erro ao otimizar: " + error.message };
        }
    },

    async generateAgentPrompt(inputs: any) {
        try {
            const ai = getAIClient();
            
            const metaPrompt = `Crie um System Instruction para um Agente de Vendas. Empresa: ${inputs.companyName}. Produto: ${inputs.product}. Público: ${inputs.audience}. Tom: ${inputs.tone}. Extra: ${inputs.extra}. Responda apenas o prompt.`;

            const result = await generateWithRetry(ai, {
                model: 'gemini-3.1-pro-preview',
                contents: metaPrompt
            });
            
            return { text: result.text };
        } catch (error: any) {
            return { error: "Falha ao gerar prompt: " + error.message };
        }
    }
};
