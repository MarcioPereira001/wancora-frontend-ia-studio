import { api } from './api';
import { supabase } from './supabaseClient';
import { Instance } from '../types';

export const whatsappService = {
  // Busca o status atualizado diretamente do banco de dados (Single Source of Truth)
  getInstanceStatus: async (): Promise<Instance | null> => {
    try {
      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .limit(1)
        .maybeSingle(); // maybeSingle evita erro se não existir

      if (error) {
          console.error('Supabase error:', error);
          return null;
      }
      return data as Instance;
    } catch (error) {
      console.error('Erro ao buscar status da instância:', error);
      return null;
    }
  },

  // Inicia a sessão no Backend (Render)
  connectInstance: async (sessionId: string = 'default') => {
    try {
      // 1. Atualiza status local para 'connecting' para feedback visual imediato
      const { data: existing } = await supabase.from('instances').select('id').eq('session_id', sessionId).maybeSingle();
      
      if (existing) {
          await supabase.from('instances').update({ status: 'connecting', qrcode_url: null }).eq('id', existing.id);
      }

      // 2. Chama API do Render para iniciar o processo do Baileys
      // O Backend deve gerar o QR e atualizar a linha no Supabase
      const response = await api.post('/instance/connect', {
        sessionId: sessionId
      });
      
      return response;
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      // Reverte status em caso de erro de rede
      throw error;
    }
  },

  // Desconecta a sessão
  logoutInstance: async (sessionId: string = 'default') => {
    try {
      // Chama endpoint de logout
      await api.delete(`/instance/logout/${sessionId}`);
      
      // Força atualização no banco caso o backend demore
      await supabase
        .from('instances')
        .update({ status: 'disconnected', qrcode_url: null })
        .eq('session_id', sessionId);
        
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      throw error;
    }
  }
};