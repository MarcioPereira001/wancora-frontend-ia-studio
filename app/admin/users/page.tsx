'use client';

import React, { useEffect, useState } from 'react';
import { 
    getAdminClients, 
    toggleCompanyStatus, 
    updateCompanyPlan, 
    impersonateByEmail 
} from '../actions';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'; // Assumindo existência ou usando div nativa se não tiver componente
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // Placeholder visual
import { 
    MoreVertical, ShieldAlert, LogIn, Lock, Unlock, 
    CreditCard, Search, Loader2, User, Users 
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

    // Dropdown Actions State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

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

    const handleToggleStatus = async (id: string, status: string) => {
        setProcessingId(id);
        try {
            await toggleCompanyStatus(id, status);
            addToast({ type: 'success', title: 'Sucesso', message: `Status alterado para ${status === 'active' ? 'Bloqueado' : 'Ativo'}` });
            loadData();
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha na operação.' });
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
        } catch (e) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao mudar plano.' });
        } finally {
            setProcessingId(null);
            setOpenMenuId(null);
        }
    };

    const handleImpersonate = async (email: string) => {
        if (!confirm(`Acessar conta de ${email}? Você será desconectado do Admin.`)) return;
        setProcessingId(email); // Use email as ID for loading state
        try {
            const res = await impersonateByEmail(email);
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (e: any) {
            addToast({ type: 'error', title: 'Erro de Acesso', message: e.message });
            setProcessingId(null);
        }
    };

    const filteredClients = clients.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.includes(searchTerm) ||
        c.profiles?.[0]?.email?.includes(searchTerm)
    );

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-6 h-6 text-red-500" />
                        Gestão de Clientes
                    </h1>
                    <p className="text-zinc-400 mt-1 text-sm">Controle total sobre tenants e acessos.</p>
                </div>
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                        placeholder="Buscar por nome, ID ou email..." 
                        className="pl-10 bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-red-900"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
            ) : (
                <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-4">Empresa / ID</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Plano</th>
                                <th className="px-6 py-4">Proprietário</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800 text-zinc-300">
                            {filteredClients.map(client => {
                                const owner = client.profiles?.[0] || {};
                                return (
                                    <tr key={client.id} className="hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-white">{client.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-1">{client.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-[10px] font-bold uppercase border",
                                                client.status === 'active' 
                                                    ? "bg-green-500/10 text-green-500 border-green-500/20" 
                                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                            )}>
                                                {client.status === 'active' ? 'ATIVO' : 'BLOQUEADO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                                client.plan === 'pro' ? "bg-purple-500/10 text-purple-400" :
                                                client.plan === 'scale' ? "bg-orange-500/10 text-orange-400" :
                                                "bg-zinc-800 text-zinc-400"
                                            )}>
                                                {client.plan}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                                                    {(owner.name?.[0] || '?').toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">{owner.name || 'Sem Dono'}</span>
                                                    <span className="text-[10px] text-zinc-500">{owner.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <div className="flex justify-end gap-2">
                                                {/* Impersonate Button */}
                                                <button 
                                                    onClick={() => handleImpersonate(owner.email)}
                                                    disabled={!!processingId}
                                                    className="p-2 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 rounded transition-colors"
                                                    title="Acessar como Cliente"
                                                >
                                                    {processingId === owner.email ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                                                </button>

                                                {/* Menu Toggle */}
                                                <button 
                                                    onClick={() => setOpenMenuId(openMenuId === client.id ? null : client.id)}
                                                    className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Dropdown Actions */}
                                            {openMenuId === client.id && (
                                                <div className="absolute right-8 top-12 z-50 w-48 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95">
                                                    <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase">Ações de Risco</div>
                                                    
                                                    <button 
                                                        onClick={() => handleToggleStatus(client.id, client.status)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-900",
                                                            client.status === 'active' ? "text-red-400" : "text-green-400"
                                                        )}
                                                    >
                                                        {client.status === 'active' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                        {client.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear'}
                                                    </button>
                                                    
                                                    <div className="h-px bg-zinc-900 my-1" />
                                                    <div className="px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase">Mudar Plano</div>
                                                    
                                                    {['starter', 'pro', 'scale'].map(plan => (
                                                        <button 
                                                            key={plan}
                                                            onClick={() => handlePlanChange(client.id, plan)}
                                                            disabled={client.plan === plan}
                                                            className={cn(
                                                                "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-zinc-900 capitalize",
                                                                client.plan === plan ? "text-zinc-600 cursor-default" : "text-zinc-300"
                                                            )}
                                                        >
                                                            <CreditCard className="w-3 h-3" /> {plan}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    
                    {filteredClients.length === 0 && (
                        <div className="p-12 text-center text-zinc-500">
                            Nenhum cliente encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}