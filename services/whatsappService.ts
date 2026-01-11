import { api } from './api';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '../types';

export const whatsappService = {
  // Busca status da instância
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

      if (error) return null;
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

      const { data } = await supabase
        .from('instances')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true });

      return (data as Instance[]) || [];
    } catch (error) {
      return [];
    }
  },

  getOneInstance: async (sessionId: string): Promise<Instance | null> => {
    try {
        const supabase = createClient();
        const { data } = await supabase
            .from('instances')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle();
        return data as Instance;
    } catch (error) {
        return null;
    }
  },

  connectInstance: async (sessionId: string = 'default', instanceName?: string): Promise<Instance> => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) throw new Error("Sessão expirada.");

      // 1. Obter Company ID do Usuário Logado
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      
      if (!profile?.company_id) throw new Error("Usuário sem empresa vinculada.");

      const displayName = instanceName || (sessionId === 'default' ? 'Principal' : sessionId);

      // 2. Limpar estado anterior no banco (Resetar QR Code antigo)
      // Isso evita que o frontend mostre um QR Code expirado enquanto o novo não chega
      const { data: instanceData, error: dbError } = await supabase
        .from('instances')
        .upsert({ 
            company_id: profile.company_id, 
            session_id: sessionId, 
            status: 'connecting', // Define status inicial
            name: displayName,
            qrcode_url: null // Limpa QR Code antigo
        }, { onConflict: 'session_id' })
        .select()
        .single();

      if (dbError) throw new Error("Falha ao preparar conexão no banco de dados.");

      // 3. Disparar Backend (Endpoint Correto: /session/start)
      // Envia sessionId E companyId conforme exigido pelo backend
      await api.post('/session/start', {
        sessionId: sessionId,
        companyId: profile.company_id
      });
      
      return instanceData as Instance;

    } catch (error) {
      console.error('Erro ao conectar:', error);
      throw error;
    }
  },

  logoutInstance: async (sessionId: string = 'default') => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      if (!profile?.company_id) return;

      // Chama backend para logout limpo (Endpoint Correto: /session/logout)
      await api.post('/session/logout', {
          sessionId: sessionId,
          companyId: profile.company_id
      });
      
      // Força atualização visual no banco caso o backend demore
      await supabase
        .from('instances')
        .update({ status: 'disconnected', qrcode_url: null })
        .eq('company_id', profile.company_id)
        .eq('session_id', sessionId);
        
    } catch (error) {
      console.error('Erro logout:', error);
      throw error;
    }
  },

  deleteInstance: async (sessionId: string) => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
  
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
        if (!profile?.company_id) return;
  
        // Tenta desconectar backend primeiro
        try {
            await api.post('/session/logout', {
                sessionId: sessionId,
                companyId: profile.company_id
            });
        } catch (e) {
            console.log("Backend offline ou já desconectado, deletando registro apenas.");
        }
  
        // Remove do banco
        await supabase
            .from('instances')
            .delete()
            .eq('company_id', profile.company_id)
            .eq('session_id', sessionId);
        
      } catch (error) {
        console.error('Erro delete:', error);
        throw error;
      }
  }
};