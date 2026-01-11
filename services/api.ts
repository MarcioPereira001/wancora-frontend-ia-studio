import { BACKEND_URL, COMPANY_ID } from '../config';

// Wrapper para Fetch API com tratamento de erro robusto
export const api = {
  get: async (endpoint: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': COMPANY_ID,
          'Accept': 'application/json'
        }
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
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': COMPANY_ID,
          'Accept': 'application/json'
        },
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
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-company-id': COMPANY_ID
            }
        });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        return true;
    } catch (error) {
        console.error(`DELETE ${endpoint} failed:`, error);
        throw error;
    }
  }
};