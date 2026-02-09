
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// CRÍTICO: Usamos a Service Role Key para ignorar RLS e agir como Super Admin
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

// Helper para logar erro de Server Action no banco
const logServerActionError = async (actionName: string, error: any, context: any = {}) => {
    try {
        await supabaseAdmin.from('system_logs').insert({
            level: 'error',
            source: 'backend', // Server Actions contam como backend
            message: `Server Action Failed: ${actionName}`,
            metadata: {
                error: error.message,
                stack: error.stack,
                context
            },
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error("Falha ao logar erro de Server Action:", e);
    }
};

export async function getAdminClients() {
    try {
        const { data: companies, error } = await supabaseAdmin
            .from('companies')
            .select(`
                *,
                profiles:profiles(email, name, phone)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            throw error; // Lança para o catch capturar e logar
        }
        return companies;
    } catch (error: any) {
        console.error("Admin Fetch Error (getAdminClients):", error.message);
        await logServerActionError('getAdminClients', error);
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
        revalidatePath('/admin/users');
        return { success: true, newStatus };
    } catch (error: any) {
        await logServerActionError('toggleCompanyStatus', error, { companyId, currentStatus });
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
        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: any) {
        await logServerActionError('updateCompanyPlan', error, { companyId, newPlan });
        throw new Error("Erro ao atualizar plano: " + error.message);
    }
}

export async function impersonateByEmail(email: string) {
    try {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        });
        if (error) throw error;
        return { url: data.properties?.action_link };
    } catch (error: any) {
        await logServerActionError('impersonateByEmail', error, { email });
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
        await logServerActionError('getAdminFeedbacks', error);
        throw new Error("Erro ao buscar feedbacks: " + error.message);
    }
}

export async function resolveFeedback(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from('feedbacks')
            .update({ status: 'resolved' })
            .eq('id', id);
        
        if (error) throw error;
        revalidatePath('/admin/feedbacks');
    } catch (error: any) {
        await logServerActionError('resolveFeedback', error, { id });
        throw error;
    }
}