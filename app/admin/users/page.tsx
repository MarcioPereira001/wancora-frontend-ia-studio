
'use client';

import React, { useEffect, useState } from 'react';
import { 
    getAdminClients, 
    toggleCompanyStatus, 
    updateCompanyPlan, 
    impersonateByEmail 
} from '../actions';
import { 
    MoreVertical, LogIn, Lock, Unlock, 
    CreditCard, Search, Loader2, Users, Building, Shield
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AdminUsersPage() {
    const { addToast } = useToast();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Carrega dados iniciais
    const loadData = async () => {
        try {
            const data = await getAdminClients();
            setClients(data || []);
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao carregar clientes.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleToggleStatus = async (id: string, status: string) => {
        setProcessingId(id);
        try {
            await toggleCompanyStatus(id, status);
            addToast({ type: 'success', title: 'Sucesso', message: 'Status atualizado.' });
            loadData();
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setProcessingId(null);
            setOpenMenuId(null);
        }
    };

    const handlePlanChange = async (id: string, plan: string) => {
        if (!confirm(`Alterar plano para ${plan}?`)) return;
        setProcessingId(id);
        try {
            await updateCompanyPlan(id, plan);
            addToast({ type: 'success', title: 'Plano Atualizado', message: `Novo plano: ${plan}` });
            loadData();
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setProcessingId(null);
            setOpenMenuId(null);
        }
    };

    const handleImpersonate = async (email: string) => {
        if (!email) return addToast({ type: 'error', title: 'Erro', message: 'Usuário sem email.' });
        
        if (!confirm(`⚠️ MODO IMPERSONATE\n\nVocê entrará na conta de: ${email}\n\nIsso desconectará sua sessão de Admin atual. Para voltar, você precisará fazer logout e login novamente como Admin.\n\nContinuar?`)) return;
        
        setProcessingId(email); 
        try {
            const res = await impersonateByEmail(email);
            if (res.url) {
                addToast({ type: 'success', title: 'Redirecionando...', message: 'Acessando conta do cliente.' });
                // Força reload completo para limpar estados do Zustand/React Query antigos
                window.location.href = res.url;
            } else {
                throw new Error("Link de acesso não gerado.");
            }
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro de Acesso', message: e.message });
            setProcessingId(null);
        }
    };

    const filteredClients = clients.filter(c => 
        (c.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company_id.includes(searchTerm)
    );

    // Fecha menu ao clicar fora
    useEffect(() => {
        const handleClick = () => setOpenMenuId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-red-500" />
                        Base de Clientes
                    </h1>
                    <p className="text-zinc-400 mt-1 text-sm">
                        {clients.length} empresas registradas.
                    </p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                        placeholder="Buscar cliente, email ou ID..." 
                        className="pl-10 bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-red-900 w-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
            ) : (
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-950 text-zinc-400 uppercase font-bold text-xs border-b border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4">Empresa / ID</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Plano</th>
                                    <th className="px-6 py-4">Proprietário</th>
                                    <th className="px-6 py-4">Cadastro</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 text-zinc-300">
                                {filteredClients.map(client => (
                                    <tr key={client.company_id} className="hover:bg-zinc-900/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-zinc-800 rounded-lg text-zinc-500">
                                                    <Building className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">{client.company_name}</div>
                                                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{client.company_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-[10px] font-bold uppercase border",
                                                client.status === 'active' 
                                                    ? "bg-green-900/20 text-green-400 border-green-900/30" 
                                                    : "bg-red-900/20 text-red-400 border-red-900/30"
                                            )}>
                                                {client.status === 'active' ? 'ATIVO' : 'BLOQUEADO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-[10px] font-bold uppercase border",
                                                client.plan === 'pro' ? "bg-purple-900/20 text-purple-400 border-purple-900/30" :
                                                client.plan === 'scale' ? "bg-orange-900/20 text-orange-400 border-orange-900/30" :
                                                "bg-zinc-800 text-zinc-400 border-zinc-700"
                                            )}>
                                                {client.plan}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                                                    {(client.user_name?.[0] || '?').toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-zinc-200">{client.user_name || 'Sem Dono'}</span>
                                                    <span className="text-[10px] text-zinc-500">{client.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-zinc-500">
                                            {client.company_created_at ? format(new Date(client.company_created_at), 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 relative">
                                                {/* Impersonate Button */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleImpersonate(client.email); }}
                                                    disabled={!!processingId || !client.email}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30 rounded transition-all text-xs font-medium disabled:opacity-50"
                                                    title="Acessar painel como este cliente"
                                                >
                                                    {processingId === client.email ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                                                    Acessar
                                                </button>

                                                {/* Menu Toggle */}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === client.company_id ? null : client.company_id); }}
                                                    className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>

                                                {/* Dropdown Actions */}
                                                {openMenuId === client.company_id && (
                                                    <div className="absolute right-0 top-9 z-50 w-48 bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 ring-1 ring-black/50" onClick={e => e.stopPropagation()}>
                                                        <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900/50">Ações de Risco</div>
                                                        
                                                        <button 
                                                            onClick={() => handleToggleStatus(client.company_id, client.status)}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2.5 text-xs flex items-center gap-2 hover:bg-zinc-800 transition-colors font-medium",
                                                                client.status === 'active' ? "text-red-400" : "text-green-400"
                                                            )}
                                                        >
                                                            {client.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                            {client.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
                                                        </button>
                                                        
                                                        <div className="h-px bg-zinc-800 my-1" />
                                                        <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Alterar Plano</div>
                                                        
                                                        {['starter', 'pro', 'scale'].map(plan => (
                                                            <button 
                                                                key={plan}
                                                                onClick={() => handlePlanChange(client.company_id, plan)}
                                                                disabled={client.plan === plan}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-800 capitalize transition-colors",
                                                                    client.plan === plan ? "text-zinc-500 cursor-default bg-zinc-900/50" : "text-zinc-300"
                                                                )}
                                                            >
                                                                <CreditCard className="w-3.5 h-3.5" /> {plan}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {filteredClients.length === 0 && (
                            <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-3">
                                <Shield className="w-12 h-12 opacity-20" />
                                <p>Nenhum cliente encontrado com os filtros atuais.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
