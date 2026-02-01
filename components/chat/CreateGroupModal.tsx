
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { ChatContact } from '@/types';
import { Users, Search, Loader2 } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  companyId: string;
  existingContacts: ChatContact[];
}

export function CreateGroupModal({ isOpen, onClose, sessionId, companyId, existingContacts }: CreateGroupModalProps) {
  const { addToast } = useToast();
  const [subject, setSubject] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Filtra apenas contatos que não são grupos e nem newsletters
  const candidates = existingContacts.filter(c => 
      !c.is_group && 
      !c.remote_jid.includes('@newsletter') &&
      ((c.name || '').toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search))
  );

  const toggleParticipant = (jid: string) => {
      setSelectedParticipants(prev => 
          prev.includes(jid) ? prev.filter(p => p !== jid) : [...prev, jid]
      );
  };

  const handleCreate = async () => {
      if (!subject.trim()) return addToast({ type: 'warning', title: 'Atenção', message: 'Defina um nome para o grupo.' });
      if (selectedParticipants.length < 1) return addToast({ type: 'warning', title: 'Atenção', message: 'Selecione pelo menos 1 participante.' });
      
      setLoading(true);
      try {
          await api.post('/management/group/create', {
              sessionId,
              companyId,
              subject,
              participants: selectedParticipants
          });
          
          addToast({ type: 'success', title: 'Sucesso', message: 'Grupo criado.' });
          onClose();
          setSubject('');
          setSelectedParticipants([]);
      } catch (error: any) {
          addToast({ type: 'error', title: 'Erro', message: error.message || 'Falha ao criar grupo.' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Grupo" maxWidth="md">
        <div className="space-y-6">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Grupo</label>
                <Input 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)} 
                    placeholder="Ex: Time de Vendas" 
                    className="bg-zinc-950 border-zinc-800"
                    maxLength={25}
                />
            </div>

            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block flex justify-between">
                    <span>Participantes ({selectedParticipants.length})</span>
                    <span className="text-primary cursor-pointer hover:underline" onClick={() => setSelectedParticipants([])}>Limpar</span>
                </label>
                
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                    <Input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder="Buscar contatos..." 
                        className="pl-9 bg-zinc-950 border-zinc-800 h-9 text-xs"
                    />
                </div>

                <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg h-60 overflow-y-auto custom-scrollbar p-1">
                    {candidates.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-zinc-500 text-xs">Nenhum contato encontrado.</div>
                    ) : (
                        candidates.map(contact => (
                            <div 
                                key={contact.id} 
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-zinc-900 transition-colors ${selectedParticipants.includes(contact.jid) ? 'bg-zinc-900' : ''}`}
                                onClick={() => toggleParticipant(contact.jid)}
                            >
                                <Checkbox checked={selectedParticipants.includes(contact.jid)} className="border-zinc-700" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-zinc-200 truncate">{contact.name || contact.push_name || 'Usuário'}</p>
                                    <p className="text-[10px] text-zinc-500">{contact.phone_number}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleCreate} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white w-full">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                    Criar Grupo
                </Button>
            </div>
        </div>
    </Modal>
  );
}
