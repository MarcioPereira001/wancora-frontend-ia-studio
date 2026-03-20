
import { BACKEND_URL } from '../config';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { SystemLogger } from '@/lib/logger'; // Integração Logger

// Configuração do Retry
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 segundo

// Função auxiliar para delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Se estiver no browser, prefira usar o proxy relativo (/api/v1) para evitar CORS
// Se estiver no server side, use a URL completa
const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return '/api/v1'; // Usa o Rewrite do Next.js
    }
    return BACKEND_URL || 'http://localhost:3001/api/v1';
};

const cleanUrl = (endpoint: string) => {
    const base = getBaseUrl();
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${cleanBase}${cleanPath}`;
};

const getHeaders = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        
        const companyId = session.user.user_metadata?.company_id;
        // Tenta pegar company_id do user_metadata ou profile se disponível no store
        if (companyId) {
            headers['x-company-id'] = companyId;
        }
    }
    return headers;
};

// INTERCEPTADOR DE ERROS DE CONEXÃO
const checkDisconnectError = (errorBody: string) => {
    if (typeof window !== 'undefined') {
        const lowerError = errorBody.toLowerCase();
        // Palavras-chave retornadas pelo Backend/Baileys quando a sessão cai
        if (
            lowerError.includes('sessão desconectada') || 
            lowerError.includes('não encontrada ou desconectada') ||
            lowerError.includes('connection closed') ||
            lowerError.includes('logged out')
        ) {
            // Dispara o Modal Global via Zustand (fora da árvore de componentes)
            useRealtimeStore.getState().setDisconnectModalOpen(true);
        }
    }
};

// Logger Helper para erros de API
const logApiError = (method: string, url: string, status: number, requestBody: unknown, responseBody: string) => {
    // Trunca corpos muito grandes para não estourar o banco
    const safeResBody = responseBody.length > 2000 ? responseBody.substring(0, 2000) + '...[TRUNCATED]' : responseBody;
    const safeReqBody = requestBody ? (JSON.stringify(requestBody).length > 1000 ? JSON.stringify(requestBody).substring(0, 1000) + '...' : requestBody) : null;

    SystemLogger.error(`API ${method} Error: ${status}`, {
        url,
        method,
        status,
        requestBody: safeReqBody,
        body: safeResBody, // Renomeado para 'body' para ficar consistente com LogViewer
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server-Side'
    });
};

// Função Wrapper com Retry Exponencial
const fetchWithRetry = async (url: string, options: RequestInit, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        
        // Se for erro 5xx (Erro de Servidor) ou 429 (Too Many Requests), tentamos novamente
        if (!response.ok && (response.status >= 500 || response.status === 429)) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        return response; // Retorna a resposta se for OK ou erro 4xx (Client Error - não adianta tentar de novo)
    } catch (error: unknown) {
        // Se acabaram as tentativas ou se o erro não é de rede/servidor (ex: erro de sintaxe)
        if (retries <= 0 || (error instanceof Error && error.name !== 'TypeError' && !error.message.includes('HTTP Error'))) {
            throw error;
        }
        
        console.warn(`[API Retry] Falha na requisição para ${url}. Tentando novamente em ${delay}ms... (${retries} tentativas restantes)`);
        await sleep(delay);
        
        // Tenta novamente com o dobro do delay (Backoff Exponencial)
        return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
};

export const api = {
  get: async (endpoint: string) => {
    const url = cleanUrl(endpoint);
    try {
      const headers = await getHeaders();
      
      const response = await fetchWithRetry(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Error ${response.status} on ${url}:`, errorBody);
        checkDisconnectError(errorBody);
        logApiError('GET', url, response.status, null, errorBody);
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error: unknown) {
      console.error(`GET ${endpoint} failed:`, error);
      // Loga exceções de rede (ex: servidor offline)
      if (error instanceof Error && !error.message?.includes('API Error')) {
          SystemLogger.error(`Network Exception GET: ${endpoint}`, { message: error.message, url });
      }
      throw error;
    }
  },

  post: async (endpoint: string, body: unknown) => {
    const url = cleanUrl(endpoint);
    try {
      const headers = await getHeaders();

      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Error ${response.status} on ${url}:`, errorBody);
        checkDisconnectError(errorBody);
        logApiError('POST', url, response.status, body, errorBody);
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error: unknown) {
      console.error(`POST ${endpoint} failed:`, error);
      if (error instanceof Error && !error.message?.includes('API Error')) {
          SystemLogger.error(`Network Exception POST: ${endpoint}`, { message: error.message, url, body: body as Record<string, unknown> });
      }
      throw error;
    }
  },

  delete: async (endpoint: string, body?: unknown) => {
    const url = cleanUrl(endpoint);
    try {
        const headers = await getHeaders();
        
        const response = await fetchWithRetry(url, {
            method: 'DELETE',
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
            const errorBody = await response.text();
            checkDisconnectError(errorBody);
            logApiError('DELETE', url, response.status, body, errorBody);
            throw new Error(`API Error: ${response.statusText}`);
        }
        return true;
    } catch (error: unknown) {
        console.error(`DELETE ${endpoint} failed:`, error);
        if (error instanceof Error && !error.message?.includes('API Error')) {
            SystemLogger.error(`Network Exception DELETE: ${endpoint}`, { message: error.message, url });
        }
        throw error;
    }
  }
};