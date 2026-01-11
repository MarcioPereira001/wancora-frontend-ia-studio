import { api } from './api';
import { supabase } from './supabaseClient';
import { Instance } from '../types';

export const whatsappService = {
  // Busca o status da instância principal (Backward Compatibility para o Chat)
  getInstanceStatus: async (): Promise<Instance | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      const companyId = profile?.company_id;

      if (!companyId) return null;

      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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

  // NOVO: Busca TODAS as instâncias da empresa para o Grid de Conexões
  getAllInstances: async (): Promise<Instance[]> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile?.company_id) return [];

      const { data, error } = await supabase
        .from('instances')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as Instance[]) || [];
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
      return [];
    }
  },

  // Inicia a sessão no Backend (Render) com suporte a SessionID dinâmico
  connectInstance: async (sessionId: string = 'default') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user.id).single();
      
      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      // 1. Atualiza status local para 'connecting' para feedback visual imediato
      const { data: existing } = await supabase
        .from('instances')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (existing) {
          await supabase.from('instances').update({ status: 'connecting', qrcode_url: null }).eq('id', existing.id);
      } else {
          // Cria registro se não existir
          await supabase.from('instances').insert({ 
              company_id: profile.company_id, 
              session_id: sessionId, 
              status: 'connecting',
              name: sessionId === 'default' ? 'Principal' : sessionId
          });
      }

      // 2. Chama API do Render para iniciar o processo do Baileys
      const response = await api.post('/instance/connect', {
        sessionId: sessionId,
        companyId: profile.company_id
      });
      
      return response;
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  },

  // Desconecta a sessão específica
  logoutInstance: async (sessionId: string = 'default') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user.id).single();

      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      // Chama endpoint de logout
      await api.delete(`/instance/logout/${sessionId}`);
      
      // Força atualização no banco caso o backend demore
      await supabase
        .from('instances')
        .update({ status: 'disconnected', qrcode_url: null })
        .eq('company_id', profile.company_id)
        .eq('session_id', sessionId);
        
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      throw error;
    }
  }
};