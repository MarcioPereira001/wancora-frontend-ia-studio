'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message, Instance, Lead } from '@/types';
import { cleanJid, cn } from '@/lib/utils';
import { 
    Loader2, Search, Send, Paperclip, Sparkles, Mic, 
    Image as IconImage, FileText, BarChart2, X, Trash2, ArrowLeft, User, Smartphone, Wifi, Clock, MoreVertical, CheckSquare, BellOff, Bell, Users, Check
} from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MessageScheduler } from '@/components/chat/MessageScheduler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Checkbox } from '@/components/ui/checkbox';
import { generateSmartReplyAction } from '@/app/actions/gemini';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { useChatList } from '@/hooks/useChatList';
import { uploadChatMedia } from '@/utils/supabase/storage';

const MESSAGES_PER_PAGE = 30;

export default function ChatPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  // --- INSTANCES ---
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  useEffect(() => {
      const fetchInstances = async () => {
          if (!user?.company_id) return;
          const { data } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', user.company_id)
            .eq('status', 'connected')
            .order('created_at', { ascending: true });

          if (data && data.length > 0) {
              setInstances(data);
              if (!selectedInstance) setSelectedInstance(data[0]);
          }
      };
      fetchInstances();
  }, [user?.company_id, supabase]); 

  // --- CHAT LOGIC ---
  const { contacts, loading: loadingContacts, refreshChats } = useChatList(selectedInstance?.session_id || null);
  
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
  // INBOX SELECTION STATE
  const [isInboxSelectionMode, setIsInboxSelectionMode] = useState(false);
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLeadToo, setDeleteLeadToo] = useState(false);
  
  // Message State & Pagination
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  
  // Message Selection & Deletion State
  const [isMsgSelectionMode, setIsMsgSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Scheduler State
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  // Media States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
      messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // --- FETCH MESSAGES (Pagination) ---
  const fetchMessages = async (offset: number) => {
      if(!activeContact || !user?.company_id) return [];
      
      // FIXED: Removido filtro de session_id. 
      // O histórico pertence ao Lead/Empresa, independente de qual instância enviou/recebeu.
      const { data, error } = await supabase
        .from('messages')
        .select(`*, contacts (push_name)`)
        .eq('remote_jid', activeContact.remote_jid) 
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false }) // Recentes primeiro
        .range(offset, offset + MESSAGES_PER_PAGE - 1);

      if (error) return [];
      return (data || []).reverse(); 
  };

  // --- REFRESH LEAD DATA ---
  const refreshLeadData = async () => {
      if(!activeContact || !user?.company_id) return;
      
      // Limpeza robusta do telefone: remove tudo que não for dígito
      const cleanPhone = activeContact.remote_jid.split('@')[0].replace(/\D/g, '');
      
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user.company_id)
        .ilike('phone', `%${cleanPhone}%`) // Busca flexível
        .limit(1)
        .maybeSingle();
        
      setActiveLead(lead);
      refreshChats(); // Atualiza lista para refletir mudanças no card
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
      if(!activeContact || !selectedInstance) {
          setActiveLead(null);
          setMessages([]);
          setIsMsgSelectionMode(false);
          setSelectedMsgIds(new Set());
          return;
      }
      
      const initChat = async () => {
          setLoadingMessages(true);
          setMessages([]);
          setHasMoreMessages(true);
          
          const initialMsgs = await fetchMessages(0);
          setMessages(initialMsgs);
          
          await refreshLeadData();
          setLoadingMessages(false);
          setTimeout(() => scrollToBottom('auto'), 100);
      };

      initChat();

      // Realtime
      // Monitora TODAS as mensagens deste contato nesta empresa, independente da sessão
      const channelName = `chat:${activeContact.remote_jid}`;
      const subscription = supabase
        .channel(channelName)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages',
            filter: `remote_jid=eq.${activeContact.remote_jid}` 
        }, (payload) => {
            const newMessage = payload.new as Message;
            const oldMessage = payload.old as Message;

            // Segurança: Garante que pertence à empresa atual
            if (newMessage?.company_id === user?.company_id || oldMessage?.company_id === user?.company_id) {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                    setTimeout(() => scrollToBottom('smooth'), 100);
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m => m.id === newMessage.id ? newMessage : m));
                } else if (payload.eventType === 'DELETE') {
                    setMessages(prev => prev.filter(m => m.id !== oldMessage.id));
                }
            }
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };
  }, [activeContact?.id, user?.company_id]); // Removido selectedInstance.session_id das deps para não resetar à toa

  // --- INBOX ACTIONS (SIDEBAR ESQUERDA) ---
  const handleInboxSelect = (jid: string) => {
      if (!isInboxSelectionMode) return;
      setSelectedInboxIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(jid)) newSet.delete(jid);
          else newSet.add(jid);
          return newSet;
      });
  };

  const handleToggleMute = async () => {
      if (selectedInboxIds.size === 0) return;
      
      // Verifica o estado "majoritário" para toggle (se a maioria está mutada, desmuta)
      const selectedContacts = contacts.filter(c => selectedInboxIds.has(c.jid));
      const allMuted = selectedContacts.every(c => c.is_muted);
      const newStatus = !allMuted;

      try {
          const { error } = await supabase
            .from('contacts')
            .update({ is_muted: newStatus })
            .in('jid', Array.from(selectedInboxIds))
            .eq('company_id', user?.company_id);

          if (error) throw error;
          
          addToast({ 
              type: 'success', 
              title: newStatus ? 'Silenciado' : 'Som Ativado', 
              message: `${selectedInboxIds.size} conversas atualizadas.` 
          });
          
          refreshChats();
          setIsInboxSelectionMode(false);
          setSelectedInboxIds(new Set());

      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao atualizar status.' });
      }
  };

  const handleDeleteChats = async () => {
      if (selectedInboxIds.size === 0) return;
      
      try {
          const jids = Array.from(selectedInboxIds);
          
          // 1. Apagar Mensagens
          await supabase.from('messages')
            .delete()
            .in('remote_jid', jids)
            .eq('company_id', user?.company_id);

          // 2. Se marcado, apagar Leads
          if (deleteLeadToo) {
              // Extrai números limpos para buscar leads
              const phones = jids.map((jid: string) => jid.split('@')[0].replace(/\D/g, ''));
              await supabase.from('leads')
                .delete()
                .in('phone', phones)
                .eq('company_id', user?.company_id);
          }

          addToast({ type: 'success', title: 'Excluído', message: 'Conversas removidas.' });
          refreshChats();
          
          // Se o contato ativo foi deletado, limpa a tela
          if (activeContact && selectedInboxIds.has(activeContact.jid)) {
              setActiveContact(null);
          }

          setIsInboxSelectionMode(false);
          setSelectedInboxIds(new Set());
          setDeleteModalOpen(false);
          setDeleteLeadToo(false);

      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao excluir.' });
      }
  };

  // --- MESSAGE SELECTION (AREA CENTRAL) ---
  const toggleMsgSelectionMode = () => {
      setIsMsgSelectionMode(!isMsgSelectionMode);
      setSelectedMsgIds(new Set());
      setShowOptionsMenu(false);
  };

  const handleSelectMessage = (msgId: string) => {
      setSelectedMsgIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(msgId)) newSet.delete(msgId);
          else newSet.add(msgId);
          return newSet;
      });
  };

  const handleDeleteSelectedMsgs = async () => {
      if (selectedMsgIds.size === 0) return;
      if (!confirm(`Excluir ${selectedMsgIds.size} mensagens?`)) return;

      const idsToDelete = Array.from(selectedMsgIds);
      setMessages(prev => prev.filter(m => !selectedMsgIds.has(m.id)));
      setIsMsgSelectionMode(false);
      setSelectedMsgIds(new Set());

      try {
          await supabase.from('messages').delete().in('id', idsToDelete);
          addToast({ type: 'success', title: 'Apagado', message: 'Mensagens removidas.' });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao deletar do servidor.' });
      }
  };

  const handleClearChat = async () => {
      if (!activeContact || !user?.company_id) return;
      if (!confirm(`TEM CERTEZA? Isso apagará TODO o histórico com ${activeContact.name}.`)) return;

      setMessages([]); 
      setShowOptionsMenu(false);

      try {
          await supabase.from('messages')
            .delete()
            .eq('remote_jid', activeContact.remote_jid)
            .eq('company_id', user.company_id);
          addToast({ type: 'success', title: 'Limpo', message: 'Conversa esvaziada.' });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao limpar conversa.' });
      }
  };

  // --- INFINITE SCROLL ---
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (container.scrollTop < 50 && hasMoreMessages && !fetchingMore && !loadingMessages) {
          setFetchingMore(true);
          const currentHeight = container.scrollHeight;
          const olderMessages = await fetchMessages(messages.length);
          if (olderMessages.length > 0) {
              setMessages(prev => [...olderMessages, ...prev]);
              setTimeout(() => {
                  if (scrollContainerRef.current) {
                      const newHeight = scrollContainerRef.current.scrollHeight;
                      scrollContainerRef.current.scrollTop = newHeight - currentHeight;
                  }
              }, 0);
          } else {
              setHasMoreMessages(false);
          }
          setFetchingMore(false);
      }
  };

  // Funções de Mensagem (Simplificadas)
  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;
      const optimisticId = Date.now().toString();
      const tempMsg: Message = {
          id: optimisticId,
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: payload.text || payload.caption || "Mídia",
          body: payload.text,
          message_type: payload.type || 'text',
          status: 'sending',
          created_at: new Date().toISOString(),
          session_id: selectedInstance.session_id,
          company_id: user.company_id,
          media_url: payload.url 
      } as any;
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => scrollToBottom('smooth'), 50);
      try {
          await api.post('/message/send', {
              sessionId: selectedInstance.session_id,
              companyId: user.company_id,
              to: activeContact.remote_jid,
              type: payload.type || 'text',
              text: payload.text,       
              url: payload.url,         
              caption: payload.caption, 
              options: payload.options, 
              name: payload.name,
              mimetype: payload.mimetype,
              fileName: payload.fileName,
              poll: payload.poll,
              location: payload.location,
              contact: payload.contact,
              ptt: payload.ptt
          });
      } catch (error) { setMessages(prev => prev.filter(m => m.id !== optimisticId)); }
  };

  const handleSendText = () => { if(input.trim()) { dispatchMessage({ type: 'text', text: input }); setInput(""); }};
  const handleScheduleMessage = async (content: string, date: Date) => { /* ... */ };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id) return;
      setMediaMenuOpen(false);
      addToast({ type: 'info', title: 'Enviando...', message: 'Fazendo upload.' });
      try {
          const { publicUrl, fileName } = await uploadChatMedia(file, user.company_id);
          let type = 'document';
          let ptt = false;
          
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) {
              type = 'audio';
              ptt = false; // Uploaded audio is not PTT
          }
          await dispatchMessage({ type, url: publicUrl, fileName: fileName, caption: input, mimetype: file.type, ptt });
          setInput(""); 
      } catch (error: any) { addToast({ type: 'error', title: 'Falha', message: error.message }); } 
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const startRecording = async () => { /* ... */ }; 
  const stopRecording = (cancel = false) => { /* ... */ }; 
  const formatTime = (s: number) => `00:${s.toString().padStart(2,'0')}`;
  const handleCreatePoll = () => { /* ... */ setPollModalOpen(false); };
  const handleSmartReply = async () => { /* ... */ };

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* 1. Sidebar Esquerda */}
      <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm", activeContact ? "hidden md:flex" : "flex")}>
        
        {/* Header da Sidebar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm">
                <Wifi className={cn("w-4 h-4", selectedInstance ? "text-green-500" : "text-zinc-500")} />
                <select 
                    className="w-full bg-transparent text-zinc-200 text-sm font-medium outline-none cursor-pointer"
                    value={selectedInstance?.session_id || ''}
                    onChange={(e) => {
                        const inst = instances.find(i => i.session_id === e.target.value);
                        setSelectedInstance(inst || null);
                        setActiveContact(null);
                    }}
                    disabled={instances.length === 0}
                >
                    {instances.length === 0 ? <option value="">Sem Conexões</option> : instances.map(i => <option key={i.session_id} value={i.session_id}>{i.name}</option>)}
                </select>
            </div>
            
            {/* Action Bar do Inbox */}
            {isInboxSelectionMode ? (
                <div className="flex items-center justify-between bg-zinc-800/80 rounded-lg px-2 py-1.5 animate-in slide-in-from-top-2">
                    <span className="text-xs text-white font-bold px-2">{selectedInboxIds.size} selecionados</span>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:text-white" onClick={handleToggleMute}>
                            <BellOff className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setDeleteModalOpen(true)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={() => { setIsInboxSelectionMode(false); setSelectedInboxIds(new Set()); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white" placeholder="Buscar..." />
                    </div>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="border border-zinc-800 hover:bg-zinc-800" 
                        onClick={() => setIsInboxSelectionMode(true)}
                        title="Selecionar Conversas"
                    >
                        <CheckSquare className="h-4 w-4 text-zinc-400" />
                    </Button>
                </div>
            )}
        </div>

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingContacts ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div> : 
             contacts.map(contact => {
                const isSelected = selectedInboxIds.has(contact.jid);
                return (
                    <div 
                        key={contact.id} 
                        onClick={() => isInboxSelectionMode ? handleInboxSelect(contact.jid) : setActiveContact(contact)} 
                        className={cn(
                            "p-4 border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 relative",
                            activeContact?.id === contact.id && !isInboxSelectionMode ? 'bg-primary/5 border-l-2 border-l-primary' : '',
                            isSelected ? "bg-primary/10" : ""
                        )}
                    >
                        <div className="flex justify-between items-start mb-1">
                            {isInboxSelectionMode && (
                                <div className="mr-3 mt-1">
                                    <Checkbox checked={isSelected} onCheckedChange={() => handleInboxSelect(contact.jid)} className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                </div>
                            )}
                            
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                 <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden relative">
                                    {contact.profile_pic_url ? (
                                        <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                                    ) : contact.is_group ? (
                                        <Users className="w-5 h-5 text-zinc-500" />
                                    ) : (
                                        <span className="text-zinc-500 font-bold">{contact.name?.charAt(0) || 'U'}</span>
                                    )}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className={cn("font-medium truncate block", activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200')}>
                                            {contact.name}
                                        </span>
                                        <span className="text-[10px] text-zinc-500">
                                            {contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-xs text-zinc-500 truncate max-w-[140px]">{contact.last_message}</p>
                                        <div className="flex gap-1">
                                            {contact.is_muted && <BellOff className="w-3 h-3 text-zinc-600" />}
                                            {contact.unread_count > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded-full min-w-[18px] text-center">{contact.unread_count}</span>}
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                );
             })}
        </div>
      </div>

      {/* 2. Área Central (Chat) */}
      <div className={cn("flex-1 flex-col bg-[#09090b] relative", activeContact ? "flex" : "hidden md:flex")}>
        {activeContact && selectedInstance ? (
            <>
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-zinc-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={() => setActiveContact(null)}><ArrowLeft className="h-5 w-5" /></Button>
                        <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden">
                             {activeContact.profile_pic_url ? <img src={activeContact.profile_pic_url} className="w-full h-full object-cover" /> : (activeContact.is_group ? <Users className="w-5 h-5 text-zinc-500" /> : <User className="w-5 h-5 text-zinc-500" />)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{activeContact.name}</h3>
                            <p className="text-xs text-zinc-400 font-mono">{cleanJid(activeContact.remote_jid)}</p>
                        </div>
                    </div>
                    
                    {/* Header Actions (Menu) */}
                    <div className="relative">
                        <Button variant="ghost" size="icon" onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-zinc-400 hover:text-white">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                        {showOptionsMenu && (
                            <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-2 w-48 z-50 animate-in fade-in slide-in-from-top-2">
                                <button 
                                    onClick={toggleMsgSelectionMode}
                                    className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                                >
                                    <CheckSquare className="w-4 h-4" /> Selecionar Mensagens
                                </button>
                                <button 
                                    onClick={handleClearChat}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Limpar Conversa
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* SCROLL CONTAINER */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 relative" 
                    style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}
                >
                    {fetchingMore && <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 text-primary/50 animate-spin" /></div>}
                    {!hasMoreMessages && !loadingMessages && messages.length > 0 && <div className="text-center py-4 text-xs text-zinc-600">Início da conversa</div>}

                    {loadingMessages ? (
                        <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
                    ) : messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex w-full mb-1`}>
                            <MessageBubble 
                                message={msg} 
                                isSelectionMode={isMsgSelectionMode}
                                isSelected={selectedMsgIds.has(msg.id)}
                                onSelect={() => handleSelectMessage(msg.id)}
                            />
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* FOOTER: INPUT OU SELECTION ACTION BAR */}
                {isMsgSelectionMode ? (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between animate-in slide-in-from-bottom-10">
                        <span className="text-sm text-white font-medium pl-2">
                            {selectedMsgIds.size} selecionada(s)
                        </span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={toggleMsgSelectionMode}>Cancelar</Button>
                            <Button 
                                variant="destructive" 
                                onClick={handleDeleteSelectedMsgs}
                                disabled={selectedMsgIds.size === 0}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Apagar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur relative">
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
                            <Button variant="outline" size="sm" onClick={handleSmartReply} disabled={isAiLoading || messages.length === 0} className="text-xs h-7 gap-2 bg-primary/5 border-primary/20">
                                {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />} IA Sugerir
                            </Button>
                        </div>

                        <div className="flex items-end gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner relative">
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100" onClick={() => setMediaMenuOpen(!mediaMenuOpen)}><Paperclip className="h-5 w-5" /></Button>
                            {mediaMenuOpen && (
                                <div className="absolute bottom-12 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 w-48 z-50">
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-sm text-zinc-300"><IconImage className="w-4 h-4 text-purple-400" /> Imagem <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} /></label>
                                    <button onClick={() => { setMediaMenuOpen(false); setPollModalOpen(true); }} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-sm text-zinc-300 w-full text-left"><BarChart2 className="w-4 h-4 text-yellow-400" /> Enquete</button>
                                </div>
                            )}
                            <textarea className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-2 max-h-32 custom-scrollbar" placeholder={isRecording ? "Gravando..." : "Digite..."} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} rows={1} />
                            
                            <div className="relative">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={cn("h-9 w-9 hover:text-white transition-colors", isSchedulerOpen ? "text-purple-500 bg-purple-500/10" : "text-zinc-400")} 
                                    onClick={() => setIsSchedulerOpen(!isSchedulerOpen)}
                                    title="Agendar Mensagem"
                                >
                                    <Clock className="h-5 w-5" />
                                </Button>
                                <MessageScheduler 
                                    isOpen={isSchedulerOpen} 
                                    onClose={() => setIsSchedulerOpen(false)}
                                    contactJid={activeContact.remote_jid}
                                    sessionId={selectedInstance.session_id}
                                    onSchedule={handleScheduleMessage}
                                />
                            </div>

                            <Button size="icon" className={`h-9 w-9 transition-transform ${input.trim() ? 'scale-100' : 'scale-0 w-0 p-0'}`} onClick={handleSendText}><Send className="h-4 w-4" /></Button>
                        </div>
                        <input type="file" className="hidden" ref={fileInputRef} />
                    </div>
                )}
            </>
        ) : (
            <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20 p-4 text-center">
                <Smartphone className="h-12 w-12 text-zinc-700 mb-4 animate-bounce" />
                <h3 className="text-lg font-medium text-zinc-300">Wancora CRM</h3>
                <p className="text-sm opacity-60">Selecione uma conexão.</p>
            </div>
        )}
      </div>

      {/* 3. Sidebar Direita */}
      {activeContact && selectedInstance && (
          <ChatSidebar 
            contact={activeContact} 
            lead={activeLead} 
            refreshLead={refreshLeadData} 
          />
      )}

      {/* Modals */}
      <Modal isOpen={pollModalOpen} onClose={() => setPollModalOpen(false)} title="Nova Enquete">
          <div className="space-y-4">
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Pergunta" />
              <Button onClick={handleCreatePoll} className="w-full">Criar</Button>
          </div>
      </Modal>

      {/* Modal Deletar Conversas */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Excluir Conversas">
          <div className="space-y-6">
              <div className="text-sm text-zinc-300 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                  <p className="font-bold text-red-400 mb-2 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Atenção</p>
                  Você está prestes a apagar {selectedInboxIds.size} conversa(s). Isso removerá todo o histórico de mensagens.
              </div>
              
              <div className="flex items-center gap-3 p-3 border border-zinc-800 rounded-lg hover:bg-zinc-900/50 cursor-pointer" onClick={() => setDeleteLeadToo(!deleteLeadToo)}>
                  <Checkbox checked={deleteLeadToo} onCheckedChange={(c) => setDeleteLeadToo(!!c)} className="data-[state=checked]:bg-red-500 border-zinc-600" />
                  <div>
                      <span className="text-sm font-bold text-white block">Apagar também no CRM?</span>
                      <span className="text-xs text-zinc-500">Se marcado, os leads vinculados serão removidos do Kanban.</span>
                  </div>
              </div>

              <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleDeleteChats}>Confirmar Exclusão</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}