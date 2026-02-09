
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

export async function getAdminClients() {
    const { data: companies, error } = await supabaseAdmin
        .from('companies')
        .select(`
            *,
            profiles:profiles(email, name, phone)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Admin Fetch Error (getAdminClients):", error.message);
        // Não lança erro genérico para facilitar o debug no frontend
        return []; 
    }
    return companies;
}

export async function toggleCompanyStatus(companyId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    const { error } = await supabaseAdmin
        .from('companies')
        .update({ status: newStatus })
        .eq('id', companyId);
    if (error) throw new Error("Erro ao atualizar status: " + error.message);
    revalidatePath('/admin/users');
    return { success: true, newStatus };
}

export async function updateCompanyPlan(companyId: string, newPlan: string) {
    const { error } = await supabaseAdmin
        .from('companies')
        .update({ plan: newPlan })
        .eq('id', companyId);
    if (error) throw new Error("Erro ao atualizar plano: " + error.message);
    revalidatePath('/admin/users');
    return { success: true };
}

export async function impersonateByEmail(email: string) {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email
    });
    if (error) throw error;
    return { url: data.properties?.action_link };
}

// --- FEEDBACK ACTIONS ---

export async function getAdminFeedbacks() {
    const { data, error } = await supabaseAdmin
        .from('feedbacks')
        .select(`
            *,
            profiles:user_id (name, email),
            companies:company_id (name)
        `)
        .order('created_at', { ascending: false });

    if (error) throw new Error("Erro ao buscar feedbacks: " + error.message);
    return data;
}

export async function resolveFeedback(id: string) {
    const { error } = await supabaseAdmin
        .from('feedbacks')
        .update({ status: 'resolved' })
        .eq('id', id);
    
    if (error) throw error;
    revalidatePath('/admin/feedbacks');
}
