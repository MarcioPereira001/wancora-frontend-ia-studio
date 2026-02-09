
import { BACKEND_URL } from '../config';
import { createClient } from '@/utils/supabase/client';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { SystemLogger } from '@/lib/logger'; // Integração Logger

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

export const api = {
  get: async (endpoint: string) => {
    const url = cleanUrl(endpoint);
    try {
      const headers = await getHeaders();
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Error ${response.status} on ${url}:`, errorBody);
        checkDisconnectError(errorBody);
        
        // LOG AUTOMÁTICO NO BANCO (Network Error)
        SystemLogger.error(`API GET Failed: ${endpoint}`, {
            status: response.status,
            body: errorBody.substring(0, 200),
            url
        });

        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error: any) {
      console.error(`GET ${endpoint} failed:`, error);
      // Loga exceções de rede (ex: servidor offline)
      if (!error.message?.includes('API Error')) {
          SystemLogger.error(`Network Error GET: ${endpoint}`, { message: error.message });
      }
      throw error;
    }
  },

  post: async (endpoint: string, body: any) => {
    const url = cleanUrl(endpoint);
    try {
      const headers = await getHeaders();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`API Error ${response.status} on ${url}:`, errorBody);
        checkDisconnectError(errorBody);

        // LOG AUTOMÁTICO NO BANCO
        SystemLogger.error(`API POST Failed: ${endpoint}`, {
            status: response.status,
            requestBody: JSON.stringify(body).substring(0, 200),
            responseBody: errorBody.substring(0, 200),
            url
        });

        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error: any) {
      console.error(`POST ${endpoint} failed:`, error);
      if (!error.message?.includes('API Error')) {
          SystemLogger.error(`Network Error POST: ${endpoint}`, { message: error.message });
      }
      throw error;
    }
  },

  delete: async (endpoint: string) => {
    const url = cleanUrl(endpoint);
    try {
        const headers = await getHeaders();
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers
        });
        if (!response.ok) {
            const errorBody = await response.text();
            checkDisconnectError(errorBody);
            
            // LOG AUTOMÁTICO
            SystemLogger.error(`API DELETE Failed: ${endpoint}`, {
                status: response.status,
                body: errorBody.substring(0, 200),
                url
            });

            throw new Error(`API Error: ${response.statusText}`);
        }
        return true;
    } catch (error: any) {
        console.error(`DELETE ${endpoint} failed:`, error);
        if (!error.message?.includes('API Error')) {
            SystemLogger.error(`Network Error DELETE: ${endpoint}`, { message: error.message });
        }
        throw error;
    }
  }
};