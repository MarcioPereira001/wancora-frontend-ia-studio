import { BACKEND_URL } from '../config';
import { createClient } from '@/utils/supabase/client';

// Helper para limpar URLs duplas (ex: /api/v1//instance)
const cleanUrl = (base: string | undefined, path: string) => {
    if (!base) return path;
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
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
      const url = cleanUrl(BACKEND_URL, endpoint);
      
      const response = await fetch(url, {
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
      const url = cleanUrl(BACKEND_URL, endpoint);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API Error ${response.status}: ${errorBody}`);
      }

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
        const url = cleanUrl(BACKEND_URL, endpoint);
        
        const response = await fetch(url, {
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