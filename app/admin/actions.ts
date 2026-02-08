
'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// CRÍTICO: Usamos a Service Role Key para ignorar RLS e agir como Super Admin
// Se não estiver definida, lançará erro.
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
    // Busca empresas e seus donos (profiles com role 'owner')
    // Nota: Supabase Join simples
    const { data: companies, error } = await supabaseAdmin
        .from('companies')
        .select(`
            *,
            profiles:profiles(email, name, phone)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Admin Fetch Error:", error);
        throw new Error("Falha ao buscar clientes.");
    }

    return companies;
}

export async function toggleCompanyStatus(companyId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    
    const { error } = await supabaseAdmin
        .from('companies')
        .update({ status: newStatus })
        .eq('id', companyId);

    if (error) throw new Error("Erro ao atualizar status.");
    revalidatePath('/admin/users');
    return { success: true, newStatus };
}

export async function updateCompanyPlan(companyId: string, newPlan: string) {
    const { error } = await supabaseAdmin
        .from('companies')
        .update({ plan: newPlan })
        .eq('id', companyId);

    if (error) throw new Error("Erro ao atualizar plano.");
    revalidatePath('/admin/users');
    return { success: true };
}

export async function impersonateUser(userId: string) {
    // Gera um Magic Link para logar como o usuário sem senha
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userId // userId aqui é o ID do auth, mas generateLink pede email geralmente.
        // Vamos buscar o email primeiro para garantir
    });
    
    // Fallback: Busca email pelo ID se necessário, mas na tabela profiles já temos
    // Vamos assumir que recebemos o email direto para facilitar
    return { error: "Use a função passando email" };
}

export async function impersonateByEmail(email: string) {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email
    });

    if (error) throw error;
    
    // Retorna a URL de ação (redirecionamento direto)
    return { url: data.properties?.action_link };
}
