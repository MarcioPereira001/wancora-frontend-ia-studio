
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, User, Phone, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { ChatContact } from '@/types';
import { useToast } from '@/hooks/useToast';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const { user } = useAuthStore();
  const { setActiveContact } = useChatStore();
  const supabase = createClient();
  const { addToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualNumber, setManualNumber] = useState('');

  // Busca em tempo real (Debounce manual)
  useEffect(() => {
      if (!isOpen || !user?.company_id) return;
      
      const delayDebounce = setTimeout(async () => {
          if (searchTerm.length < 3) {
              setResults([]);
              return;
          }
          
          setLoading(true);
          
          // Busca em Contatos e Leads
          // Limitamos a 10 resultados para performance
          const { data, error } = await supabase
              .from('contacts')
              .select('jid, name, push_name, phone, profile_pic_url')
              .eq('company_id', user.company_id)
              .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
              .limit(10);

          if (!error && data) {
              setResults(data);
          }
          setLoading(false);
      }, 500);

      return () => clearTimeout(delayDebounce);
  }, [searchTerm, isOpen, user?.company_id]);

  // Atualiza input manual se for número
  useEffect(() => {
      const clean = searchTerm.replace(/\D/g, '');
      setManualNumber(clean);
  }, [searchTerm]);

  const handleSelectContact = (contact: any) => {
      const chatContact: ChatContact = {
          id: contact.jid,
          jid: contact.jid,
          remote_jid: contact.jid,
          company_id: user?.company_id || '',
          name: contact.name || contact.push_name || 'Desconhecido',
          phone_number: contact.phone,
          profile_pic_url: contact.profile_pic_url,
          unread_count: 0
      };
      
      setActiveContact(chatContact);
      onClose();
  };

  const handleManualStart = () => {
      if (manualNumber.length < 10) {
          addToast({ type: 'warning', title: 'Número Inválido', message: 'O número deve ter DDD + Telefone.' });
          return;
      }

      // Constrói JID padrão BR (pode precisar de ajuste para internacional)
      // Remove o 9 adicional se necessário ou mantém conforme input
      // Padrão Baileys: DDI + DDD + Numero @s.whatsapp.net
      let jid = manualNumber;
      if (!jid.includes('@')) {
          jid = `${jid}@s.whatsapp.net`;
      }

      const tempContact: ChatContact = {
          id: jid,
          jid: jid,
          remote_jid: jid,
          company_id: user?.company_id || '',
          name: `+${manualNumber}`,
          phone_number: manualNumber,
          unread_count: 0,
          profile_pic_url: null
      };

      setActiveContact(tempContact);
      onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Conversa" maxWidth="md">
        <div className="space-y-6 min-h-[300px]">
            
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Busque por nome ou digite o número..."
                    className="pl-10 h-12 text-lg bg-zinc-950 border-zinc-800 focus:border-primary"
                    autoFocus
                />
            </div>

            {/* Lista de Resultados */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
                ) : results.length > 0 ? (
                    <>
                        <p className="text-xs font-bold text-zinc-500 uppercase px-1">Encontrados</p>
                        <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-1">
                            {results.map((c) => (
                                <button
                                    key={c.jid}
                                    onClick={() => handleSelectContact(c)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-900 transition-colors text-left group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden shrink-0">
                                        {c.profile_pic_url ? (
                                            <img src={c.profile_pic_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-5 h-5 text-zinc-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{c.name || c.push_name}</p>
                                        <p className="text-xs text-zinc-500 font-mono">{c.phone}</p>
                                    </div>
                                    <MessageCircle className="w-4 h-4 text-zinc-600 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                </button>
                            ))}
                        </div>
                    </>
                ) : searchTerm.trim() ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-zinc-500">Nenhum contato salvo encontrado.</p>
                    </div>
                ) : null}
            </div>

            {/* Botão de Ação Manual */}
            {manualNumber.length >= 8 && (
                <div className="pt-4 border-t border-zinc-800 animate-in slide-in-from-bottom-2">
                    <button 
                        onClick={handleManualStart}
                        className="w-full flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                <Phone className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-primary">Iniciar conversa com número</p>
                                <p className="text-xs text-primary/70 font-mono tracking-wider">+{manualNumber}</p>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    </Modal>
  );
}
