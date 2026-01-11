import { api } from './api';
import { supabase } from './supabaseClient';
import { Instance } from '../types';

export const whatsappService = {
  // Busca o status da instância principal
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
          return null;
      }
      return data as Instance;
    } catch (error) {
      console.error('Erro ao buscar status da instância:', error);
      return null;
    }
  },

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

  // Retorna o objeto Instance criado/atualizado para o frontend monitorar
  connectInstance: async (sessionId: string = 'default', instanceName?: string): Promise<Instance> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user.id).single();
      
      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      const displayName = instanceName || (sessionId === 'default' ? 'Principal' : sessionId);

      // 1. Upsert no Supabase para garantir que o registro exista com status 'connecting'
      // Usamos upsert para evitar erros de chave duplicada e resetar estados antigos
      const { data: instanceData, error: dbError } = await supabase
        .from('instances')
        .upsert({ 
            company_id: profile.company_id, 
            session_id: sessionId, 
            status: 'connecting',
            name: displayName,
            qrcode_url: null // Limpa QR antigo
        }, { onConflict: 'session_id' })
        .select()
        .single();

      if (dbError) {
          console.error("Erro DB Supabase:", dbError);
          throw new Error("Falha ao registrar instância no banco de dados.");
      }

      // 2. Chama API do Backend para iniciar o processo
      // Não esperamos o QR code aqui, pois o backend deve atualizar o banco via webhook/admin client
      await api.post('/instance/connect', {
        sessionId: sessionId,
        companyId: profile.company_id
      });
      
      return instanceData as Instance;

    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  },

  logoutInstance: async (sessionId: string = 'default') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user.id).single();

      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      await api.delete(`/instance/logout/${sessionId}`);
      
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