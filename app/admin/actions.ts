
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// CRÍTICO: Cliente Admin com Service Role (Bypass RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Helper de Log
const logAdminAction = async (action: string, details: any, level: 'info' | 'error' = 'info') => {
    try {
        await supabaseAdmin.from('system_logs').insert({
            level,
            source: 'backend',
            message: `Admin Action: ${action}`,
            metadata: details,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error("Falha ao logar ação admin:", e);
    }
};

export async function getAdminClients() {
    try {
        // Tenta usar a View otimizada primeiro
        const { data: viewData, error: viewError } = await supabaseAdmin
            .from('view_admin_clients')
            .select('*')
            .order('company_created_at', { ascending: false });

        if (!viewError && viewData) {
            return viewData;
        }

        // Fallback: Query manual se a view não existir
        const { data: companies, error } = await supabaseAdmin
            .from('companies')
            .select(`
                id, name, plan, status, created_at,
                profiles:profiles(id, email, name, role)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Normaliza dados para o formato da view
        return companies.map(c => {
            const owner = Array.isArray(c.profiles) 
                ? c.profiles.find((p: any) => p.role === 'owner') || c.profiles[0] 
                : c.profiles;
                
            return {
                company_id: c.id,
                company_name: c.name,
                plan: c.plan,
                status: c.status,
                company_created_at: c.created_at,
                user_id: owner?.id,
                email: owner?.email,
                user_name: owner?.name,
                role: owner?.role
            };
        });

    } catch (error: any) {
        console.error("Admin Fetch Error:", error.message);
        await logAdminAction('getAdminClients', { error: error.message }, 'error');
        return []; 
    }
}

export async function toggleCompanyStatus(companyId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
        
        const { error } = await supabaseAdmin
            .from('companies')
            .update({ status: newStatus })
            .eq('id', companyId);
        
        if (error) throw error;

        await logAdminAction('toggleCompanyStatus', { companyId, newStatus });
        revalidatePath('/admin/users');
        return { success: true, newStatus };
    } catch (error: any) {
        throw new Error("Erro ao atualizar status: " + error.message);
    }
}

export async function updateCompanyPlan(companyId: string, newPlan: string) {
    try {
        const { error } = await supabaseAdmin
            .from('companies')
            .update({ plan: newPlan })
            .eq('id', companyId);
        
        if (error) throw error;

        await logAdminAction('updateCompanyPlan', { companyId, newPlan });
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: any) {
        throw new Error("Erro ao atualizar plano: " + error.message);
    }
}

// A MÁGICA DO IMPERSONATE
export async function impersonateByEmail(email: string) {
    if (!email) throw new Error("Email inválido para impersonate.");

    try {
        // Gera um Magic Link com validade curta (60s)
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard`
            }
        });

        if (error) throw error;
        
        await logAdminAction('impersonateUser', { targetEmail: email });
        
        // Retorna a URL de ação que contém o token de acesso
        // Ao visitar essa URL, o Supabase setará os cookies do usuário alvo
        return { url: data.properties?.action_link };
    } catch (error: any) {
        await logAdminAction('impersonateUser_Failed', { email, error: error.message }, 'error');
        throw error;
    }
}

// --- FEEDBACK ACTIONS ---

export async function getAdminFeedbacks() {
    try {
        const { data, error } = await supabaseAdmin
            .from('feedbacks')
            .select(`
                *,
                profiles:user_id (name, email),
                companies:company_id (name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error: any) {
        return [];
    }
}

export async function resolveFeedback(id: string) {
    try {
        await supabaseAdmin.from('feedbacks').update({ status: 'resolved' }).eq('id', id);
        revalidatePath('/admin/feedbacks');
    } catch (error) {}
}
