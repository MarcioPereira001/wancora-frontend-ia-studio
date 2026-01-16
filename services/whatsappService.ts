import { api } from './api';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '../types';

export const whatsappService = {
  // CONTRACT COMPLIANCE:
  // Este método agora lê APENAS do Banco de Dados.
  // O Backend atualiza o banco, o Frontend lê do banco. Sem chamadas REST GET desnecessárias.
  getInstanceStatus: async (sessionId?: string): Promise<Instance | null> => {
    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession?.user?.id) return null;
      
      // Otimização: Pegar company_id direto do metadata se possível, ou profile
      let companyId = authSession.user.user_metadata?.company_id;
      
      if (!companyId) {
          const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', authSession.user.id).single();
          companyId = profile?.company_id;
      }
      
      if (!companyId) return null;

      let query = supabase.from('instances').select('*').eq('company_id', companyId);
      
      if (sessionId) {
          query = query.eq('session_id', sessionId);
      } else {
          query = query.order('updated_at', { ascending: false }).limit(1);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) {
          console.error("DB Error getInstanceStatus:", error);
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

      // Recuperação segura do company_id
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

      // 1. Prepara o banco (Optimistic Update)
      // Define status como 'connecting' para a UI mostrar loading imediatamente
      const { data: instanceData, error: dbError } = await supabase
        .from('instances')
        .upsert({ 
            company_id: profile.company_id, 
            session_id: sessionId, 
            status: 'connecting', 
            name: displayName,
            qrcode_url: null,
            updated_at: new Date().toISOString()
        }, { onConflict: 'session_id' })
        .select()
        .single();

      if (dbError) throw new Error("Falha ao preparar conexão no banco.");

      // 2. Dispara Backend (Fire and Forget logic from UX perspective)
      // O Backend vai processar e atualizar o banco com 'qrcode' ou 'connected'
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

      // 1. Chama backend para derrubar conexão real
      await api.post('/session/logout', {
          sessionId: sessionId,
          companyId: profile.company_id
      });
      
      // 2. Atualiza banco (Backend também faz, mas fazemos aqui para feedback imediato)
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
  
        // Tenta logout limpo antes de deletar
        try {
            await api.post('/session/logout', {
                sessionId: sessionId,
                companyId: profile.company_id
            });
        } catch (e) {
            // Ignora erro se backend já estiver off
        }
  
        // Hard Delete do registro
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