import { BACKEND_URL } from '../config';
import { supabase } from './supabaseClient';

// Wrapper para Fetch API com tratamento de erro robusto
const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (session) {
        // Authenticated request
        headers['Authorization'] = `Bearer ${session.access_token}`;
        
        // Tentativa de obter company_id do metadata (assumindo que foi salvo no login/signup)
        // Se não houver, o backend deve tratar ou o usuário deve relogar
        const companyId = session.user.user_metadata?.company_id;
        if (companyId) {
            headers['x-company-id'] = companyId;
        }
    }
    return headers;
};

export const api = {
  get: async (endpoint: string) => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`GET ${endpoint} failed:`, error);
      throw error;
    }
  },

  post: async (endpoint: string, body: any) => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

      // Tenta fazer parse do JSON, mas se não tiver corpo (ex: 204), retorna null
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      console.error(`POST ${endpoint} failed:`, error);
      throw error;
    }
  },

  delete: async (endpoint: string) => {
    try {
        const headers = await getHeaders();
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'DELETE',
            headers
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return true;
    } catch (error) {
        console.error(`DELETE ${endpoint} failed:`, error);
        throw error;
    }
  }
};