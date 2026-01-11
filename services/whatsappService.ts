import { api } from './api';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '../types';

export const whatsappService = {
  // Busca o status da instância principal via Banco de Dados (Supabase)
  getInstanceStatus: async (): Promise<Instance | null> => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) return null;

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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) return [];

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

  getOneInstance: async (sessionId: string): Promise<Instance | null> => {
    try {
        const supabase = createClient();
        // Adicionado cache-busting para garantir leitura fresca
        const { data } = await supabase
            .from('instances')
            .select('*')
            .eq('session_id', sessionId)
            .single();
        return data as Instance;
    } catch (error) {
        return null;
    }
  },

  // Retorna o objeto Instance criado/atualizado para o frontend monitorar
  connectInstance: async (sessionId: string = 'default', instanceName?: string): Promise<Instance> => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) {
          throw new Error("Sessão expirada. Por favor, recarregue a página.");
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      
      if (profileError || !profile?.company_id) {
          throw new Error("Usuário sem empresa vinculada.");
      }

      const displayName = instanceName || (sessionId === 'default' ? 'Principal' : sessionId);

      // 1. Upsert no Supabase para garantir que o registro exista para monitoramento Realtime
      const { data: instanceData, error: dbError } = await supabase
        .from('instances')
        .upsert({ 
            company_id: profile.company_id, 
            session_id: sessionId, 
            status: 'connecting',
            name: displayName,
            qrcode_url: null 
        }, { onConflict: 'session_id' })
        .select()
        .single();

      if (dbError) {
          console.error("Erro DB Supabase:", dbError);
          throw new Error("Falha ao registrar instância no banco de dados.");
      }

      // 2. Chama API do Backend para iniciar o processo (/session/start)
      await api.post('/session/start', {
        sessionId: sessionId,
        companyId: profile.company_id
      });
      
      return instanceData as Instance;

    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  },

  // Apenas desconecta (Logout), mantendo o registro no banco
  logoutInstance: async (sessionId: string = 'default') => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) throw new Error("Usuário não autenticado.");

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      // Chama backend para matar processo
      await api.post('/session/logout', {
          sessionId: sessionId,
          companyId: profile.company_id
      });
      
      // Atualiza visualmente no banco
      await supabase
        .from('instances')
        .update({ status: 'disconnected', qrcode_url: null })
        .eq('company_id', profile.company_id)
        .eq('session_id', sessionId);
        
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      throw error;
    }
  },

  // NOVO: Exclui a instância permanentemente (Lixeira)
  deleteInstance: async (sessionId: string) => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error("Usuário não autenticado.");
  
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile?.company_id) throw new Error("Usuário sem empresa.");
  
        // 1. Tenta desconectar no backend primeiro (se estiver rodando)
        try {
            await api.post('/session/logout', {
                sessionId: sessionId,
                companyId: profile.company_id
            });
        } catch (e) {
            console.log("Backend já estava desconectado ou inacessível, prosseguindo com delete do DB.");
        }
  
        // 2. Remove do Supabase
        const { error } = await supabase
            .from('instances')
            .delete()
            .eq('company_id', profile.company_id)
            .eq('session_id', sessionId);

        if (error) throw error;
        
      } catch (error) {
        console.error('Erro ao excluir instância:', error);
        throw error;
      }
  }
};
