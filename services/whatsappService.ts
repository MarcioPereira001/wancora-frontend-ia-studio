import { api } from './api';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '../types';

export const whatsappService = {
  // Busca o status da instância principal
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

      // 1. Upsert no Supabase
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

      // 2. Chama API do Backend para iniciar o processo
      // MUDANÇA: Endpoint alterado para /instance/create que é o padrão REST mais comum para iniciar instâncias
      // Payload expandido para garantir que o backend receba os identificadores corretos
      await api.post('/instance/create', {
        id: sessionId,          // Para backends que usam 'id'
        sessionId: sessionId,   // Para backends que usam 'sessionId'
        name: displayName,      // Nome display
        companyId: profile.company_id,
        webhook: true           // Habilitar webhooks se suportado
      });
      
      return instanceData as Instance;

    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  },

  logoutInstance: async (sessionId: string = 'default') => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user?.id) throw new Error("Usuário não autenticado.");

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();

      if (!profile?.company_id) throw new Error("Usuário sem empresa.");

      // Endpoint padrão para delete/logout
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