import { api } from './api';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '../types';

export const whatsappService = {
  // Busca status via API (prioridade) ou Supabase (fallback)
  // Contract Update: GET /session/status/:companyId
  getInstanceStatus: async (sessionId?: string): Promise<Instance | null> => {
    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession?.user?.id) return null;
      
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', authSession.user.id).single();
      const companyId = profile?.company_id;
      
      if (!companyId) return null;

      // 1. Tentativa via API (Realtime Status do Container)
      try {
         // O contrato define /session/status/:companyId
         const apiData = await api.get(`/session/status/${companyId}`);
         
         // A API retorna { status: 'online', session: 'connected' | 'disconnected' }
         // Precisamos mesclar isso com os dados do banco para ter QR Code e metadados
         if (apiData && sessionId) {
             const { data: dbInstance } = await supabase
                .from('instances')
                .select('*')
                .eq('session_id', sessionId)
                .maybeSingle();
             
             if (dbInstance) {
                 // Se a API diz que está online, forçamos o status visual, mas respeitamos o QR Code do banco
                 return {
                     ...dbInstance,
                     status: apiData.session === 'connected' ? 'connected' : dbInstance.status
                 };
             }
         }
      } catch (e) {
         // Silencioso: Backend pode estar dormindo (Render free tier), fallback para banco
      }

      // 2. Fallback: Banco de Dados (Supabase)
      let query = supabase.from('instances').select('*').eq('company_id', companyId);
      
      if (sessionId) {
          query = query.eq('session_id', sessionId);
      } else {
          query = query.order('created_at', { ascending: false }).limit(1);
      }

      const { data } = await query.maybeSingle();
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

  connectInstance: async (sessionId: string = 'default', instanceName?: string): Promise<Instance> => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.id) throw new Error("Sessão expirada.");

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session.user.id).single();
      
      if (!profile?.company_id) throw new Error("Usuário sem empresa vinculada.");

      const displayName = instanceName || (sessionId === 'default' ? 'Principal' : sessionId);

      // Limpa QR Code antigo e define status inicial
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

      if (dbError) throw new Error("Falha ao preparar conexão no banco.");

      // Dispara Backend (Endpoint: /session/start)
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

      // Chama backend (Endpoint: /session/logout)
      await api.post('/session/logout', {
          sessionId: sessionId,
          companyId: profile.company_id
      });
      
      // Update otimista
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
  
        try {
            await api.post('/session/logout', {
                sessionId: sessionId,
                companyId: profile.company_id
            });
        } catch (e) {
            // Backend pode já estar off
        }
  
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