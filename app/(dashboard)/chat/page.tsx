'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message, Instance, Lead } from '@/types';
import { cleanJid, cn } from '@/lib/utils';
import { 
    Loader2, Search, Send, Paperclip, Sparkles, Mic, 
    Image as IconImage, FileText, BarChart2, X, Trash2, ArrowLeft, User, Smartphone, Wifi, Clock, MoreVertical, CheckSquare, BellOff, Bell, Users, Check, MapPin, DollarSign, List, Calendar, Plus, Copy
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
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredContacts = useMemo(() => {
      if (!searchTerm) return contacts;
      const lower = searchTerm.toLowerCase();
      return contacts.filter(c => 
          c.name.toLowerCase().includes(lower) || 
          c.push_name?.toLowerCase().includes(lower) ||
          c.phone_number?.includes(lower)
      );
  }, [contacts, searchTerm]);

  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
  // INBOX SELECTION
  const [isInboxSelectionMode, setIsInboxSelectionMode] = useState(false);
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLeadToo, setDeleteLeadToo] = useState(false);
  
  // Message State
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  
  // Selection & UI
  const [isMsgSelectionMode, setIsMsgSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  
  // -- MODALS STATE --
  const [activeModal, setActiveModal] = useState<'poll'|'pix'|'contact'|'location'|null>(null);
  
  // Poll Data
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Sim", "Não"]);
  
  // Pix Data
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("cpf");
  
  // Contact Data
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
      messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // --- ACTIONS ---
  
  const handleContactSelect = async (contact: ChatContact) => {
      if (isInboxSelectionMode) {
          handleInboxSelect(contact.jid);
          return;
      }
      setActiveContact(contact);
      setSearchTerm("");
      
      if (contact.unread_count > 0) {
          await supabase.from('contacts').update({ unread_count: 0 }).eq('jid', contact.jid).eq('company_id', user?.company_id);
          refreshChats();
      }
  };

  // --- FETCH MESSAGES ---
  const fetchMessages = async (offset: number) => {
      if(!activeContact || !selectedInstance) return [];
      const { data, error } = await supabase
        .from('messages')
        .select(`*, contacts (push_name)`)
        .eq('remote_jid', activeContact.remote_jid) 
        .eq('session_id', selectedInstance.session_id) 
        .eq('company_id', user?.company_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + MESSAGES_PER_PAGE - 1);
      if (error) return [];
      return (data || []).reverse(); 
  };

  // --- LEAD REFRESH ---
  const refreshLeadData = async () => {
      if(!activeContact || !user?.company_id) return;
      const cleanPhone = activeContact.remote_jid.split('@')[0].replace(/\D/g, '');
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user.company_id)
        .ilike('phone', `%${cleanPhone}%`)
        .limit(1)
        .maybeSingle();
      setActiveLead(lead);
      refreshChats();
  };

  // --- INIT CHAT ---
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

      const channelName = `chat:${activeContact.remote_jid}:${selectedInstance.session_id}`;
      const subscription = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `remote_jid=eq.${activeContact.remote_jid}` }, (payload) => {
            if (payload.new && (payload.new as any).session_id !== selectedInstance.session_id) return;
            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new as Message;
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    const now = new Date(newMessage.created_at).getTime();
                    const index = prev.findIndex(m => m.status === 'sending' && m.content === newMessage.content && m.from_me === newMessage.from_me && Math.abs(new Date(m.created_at).getTime() - now) < 5000);
                    if (index !== -1) { const newArr = [...prev]; newArr[index] = newMessage; return newArr; }
                    return [...prev, newMessage];
                });
                if (scrollContainerRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
                    if (scrollHeight - scrollTop - clientHeight < 200) setTimeout(() => scrollToBottom('smooth'), 100);
                }
                if (!newMessage.from_me) supabase.from('contacts').update({ unread_count: 0 }).eq('jid', activeContact.remote_jid);
            } else if (payload.eventType === 'UPDATE') {
                setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m));
            } else if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };
  }, [activeContact?.id, selectedInstance?.session_id]);

  // --- SENDING LOGIC ---
  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;
      
      const tempId = `temp-${Date.now()}`;
      const tempMsg: Message = {
          id: tempId,
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: payload.text || payload.caption || JSON.stringify(payload.content) || "Mídia",
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
              content: payload.content, // Para Polls/Contatos complexos
              name: payload.name        
          });
      } catch (error) { 
          addToast({ type: 'error', title: 'Falha', message: 'Erro ao enviar mensagem.' });
          setMessages(prev => prev.filter(m => m.id !== tempId)); 
      }
  };

  const handleSendText = () => { if(input.trim()) { dispatchMessage({ type: 'text', text: input }); setInput(""); }};
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id) return;
      setMediaMenuOpen(false);
      addToast({ type: 'info', title: 'Upload', message: 'Enviando arquivo...' });
      
      try {
          const { publicUrl, fileName } = await uploadChatMedia(file, user.company_id);
          let type = 'document';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) type = 'audio';
          
          await dispatchMessage({ type, url: publicUrl, caption: input, fileName });
          setInput("");
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      }
  };

  // --- SPECIAL SEND HANDLERS ---
  const handleCreatePoll = () => {
      if(!pollQuestion.trim() || pollOptions.length < 2) return;
      const validOptions = pollOptions.filter(o => o.trim());
      dispatchMessage({ 
          type: 'poll', 
          content: { name: pollQuestion, options: validOptions } 
      });
      setPollQuestion(""); setPollOptions(["Sim", "Não"]); setActiveModal(null);
  };

  const handleSendPix = () => {
      if(!pixKey.trim()) return;
      // Envia como Texto Formatado ou Tipo Pix se o backend suportar
      const text = `Chave Pix: ${pixKey}`;
      dispatchMessage({ type: 'pix', text });
      setPixKey(""); setActiveModal(null);
  };

  const handleSendContact = () => {
      if(!contactName.trim() || !contactPhone.trim()) return;
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL:${contactPhone}\nEND:VCARD`;
      dispatchMessage({ type: 'contact', content: { displayName: contactName, vcard } });
      setContactName(""); setContactPhone(""); setActiveModal(null);
  };

  const handleSendLocation = () => {
      // Simulação Web: Envia coordenadas fixas ou pede input (aqui vamos simplificar pedindo input manual ou pegando atual)
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              dispatchMessage({ 
                  type: 'location', 
                  content: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } 
              });
              setActiveModal(null);
          }, () => {
              addToast({ type: 'error', title: 'Erro', message: 'Permissão de localização negada.' });
          });
      }
  };

  // --- UTILS ---
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (container.scrollTop < 50 && hasMoreMessages && !fetchingMore && !loadingMessages) {
          setFetchingMore(true);
          const olderMessages = await fetchMessages(messages.length);
          if (olderMessages.length > 0) {
              setMessages(prev => [...olderMessages, ...prev]);
              setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - container.scrollHeight; }, 0);
          } else {
              setHasMoreMessages(false);
          }
          setFetchingMore(false);
      }
  };

  const handleInboxSelect = (jid: string) => {
      setSelectedInboxIds(prev => { const n = new Set(prev); if(n.has(jid)) n.delete(jid); else n.add(jid); return n; });
  };

  // Logic placeholders to satisfy imports
  const handleToggleMute = async () => {};
  const handleDeleteChats = async () => {};
  const toggleMsgSelectionMode = () => { setIsMsgSelectionMode(!isMsgSelectionMode); setSelectedMsgIds(new Set()); setShowOptionsMenu(false); };
  const handleSelectMessage = (id: string) => { setSelectedMsgIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const handleDeleteSelectedMsgs = async () => {};
  const handleClearChat = async () => {};
  const handleSmartReply = async () => {};
  const handleScheduleMessage = (content: string, date: Date) => {};

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* SIDEBAR ESQUERDA */}
      <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm", activeContact ? "hidden md:flex" : "flex")}>
        {/* Header Inbox */}
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
            
            {isInboxSelectionMode ? (
                <div className="flex items-center justify-between bg-zinc-800/80 rounded-lg px-2 py-1.5 animate-in slide-in-from-top-2">
                    <span className="text-xs text-white font-bold px-2">{selectedInboxIds.size} selecionados</span>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsInboxSelectionMode(false)}><X className="h-4 w-4" /></Button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input 
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white" 
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button size="icon" variant="ghost" className="border border-zinc-800 hover:bg-zinc-800" onClick={() => setIsInboxSelectionMode(true)}>
                        <CheckSquare className="h-4 w-4 text-zinc-400" />
                    </Button>
                </div>
            )}
        </div>

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingContacts ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div> : 
             filteredContacts.map(contact => {
                const isSelected = selectedInboxIds.has(contact.jid);
                const isNewLead = contact.updated_at && (new Date().getTime() - new Date(contact.updated_at).getTime() < 24 * 60 * 60 * 1000);

                return (
                    <div 
                        key={contact.id} 
                        onClick={() => handleContactSelect(contact)}
                        className={cn(
                            "p-4 border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 relative transition-colors",
                            activeContact?.id === contact.id && !isInboxSelectionMode ? 'bg-primary/5 border-l-2 border-l-primary' : '',
                            isSelected ? "bg-primary/10" : ""
                        )}
                    >
                        <div className="flex justify-between items-start mb-1">
                            {isInboxSelectionMode && (
                                <div className="mr-3 mt-1">
                                    <Checkbox checked={isSelected} onCheckedChange={() => handleInboxSelect(contact.jid)} className="border-zinc-600 data-[state=checked]:bg-primary" />
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
                                        <div className="flex items-center gap-1">
                                            {isNewLead && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded uppercase font-bold">Novo</span>}
                                            {contact.unread_count > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded-full min-w-[18px] text-center shadow-lg shadow-green-500/20 animate-pulse">{contact.unread_count}</span>}
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

      {/* ÁREA CENTRAL */}
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
                    
                    {/* Header Actions */}
                    <div className="relative">
                        <Button variant="ghost" size="icon" onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-zinc-400 hover:text-white">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                        {showOptionsMenu && (
                            <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-2 w-48 z-50 animate-in fade-in slide-in-from-top-2">
                                <button onClick={toggleMsgSelectionMode} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Selecionar</button>
                                <button onClick={handleClearChat} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Limpar</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* SCROLL MESSAGES */}
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

                {/* INPUT AREA */}
                {isMsgSelectionMode ? (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between animate-in slide-in-from-bottom-10">
                        <span className="text-sm text-white font-medium pl-2">{selectedMsgIds.size} selecionadas</span>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={toggleMsgSelectionMode}>Cancelar</Button>
                            <Button variant="destructive" onClick={handleDeleteSelectedMsgs} disabled={selectedMsgIds.size === 0}><Trash2 className="w-4 h-4 mr-2" /> Apagar</Button>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur relative">
                        <div className="flex items-end gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner relative">
                            {/* Anexo Menu (Expansível) */}
                            <div className="relative">
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100" onClick={() => setMediaMenuOpen(!mediaMenuOpen)}><Paperclip className="h-5 w-5" /></Button>
                                {mediaMenuOpen && (
                                    <div className="absolute bottom-12 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 w-56 z-50 grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2">
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <IconImage className="w-5 h-5 text-purple-400" /> Galeria
                                            <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                                        </label>
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <FileText className="w-5 h-5 text-blue-400" /> Documento
                                            <input type="file" className="hidden" accept="*" onChange={handleFileUpload} />
                                        </label>
                                        <button onClick={() => { setMediaMenuOpen(false); setActiveModal('location'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <MapPin className="w-5 h-5 text-red-400" /> Localização
                                        </button>
                                        <button onClick={() => { setMediaMenuOpen(false); setActiveModal('contact'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <User className="w-5 h-5 text-blue-400" /> Contato
                                        </button>
                                        <button onClick={() => { setMediaMenuOpen(false); setActiveModal('poll'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <BarChart2 className="w-5 h-5 text-yellow-400" /> Enquete
                                        </button>
                                        <button onClick={() => { setMediaMenuOpen(false); setActiveModal('pix'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <DollarSign className="w-5 h-5 text-green-400" /> Pix
                                        </button>
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <span className="w-5 h-5 flex items-center justify-center border-2 border-zinc-600 rounded-full text-[10px] font-bold">PTT</span>
                                            Áudio
                                            <input type="file" className="hidden" accept="audio/*" capture onClick={(e) => { e.stopPropagation(); }} onChange={handleFileUpload} />
                                        </label>
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <span className="w-5 h-5 flex items-center justify-center border-2 border-zinc-600 rounded-lg text-[10px] font-bold">CAM</span>
                                            Câmera
                                            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <textarea className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-2 max-h-32 custom-scrollbar" placeholder="Digite..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} rows={1} />
                            
                            <Button size="icon" className={`h-9 w-9 transition-transform ${input.trim() ? 'scale-100' : 'scale-0 w-0 p-0'}`} onClick={handleSendText}><Send className="h-4 w-4" /></Button>
                        </div>
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

      {/* SIDEBAR DIREITA */}
      {activeContact && selectedInstance && (
          <ChatSidebar contact={activeContact} lead={activeLead} refreshLead={refreshLeadData} />
      )}

      {/* --- MODALS DE ANEXO --- */}
      
      {/* 1. POLL MODAL */}
      <Modal isOpen={activeModal === 'poll'} onClose={() => setActiveModal(null)} title="Nova Enquete">
          <div className="space-y-4">
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Pergunta da enquete" />
              <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                      <Input 
                        key={idx} 
                        value={opt} 
                        onChange={e => {
                            const newOpts = [...pollOptions];
                            newOpts[idx] = e.target.value;
                            setPollOptions(newOpts);
                        }} 
                        placeholder={`Opção ${idx + 1}`} 
                      />
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setPollOptions([...pollOptions, ""])} className="w-full text-xs">+ Adicionar Opção</Button>
              </div>
              <Button onClick={handleCreatePoll} className="w-full">Criar Enquete</Button>
          </div>
      </Modal>

      {/* 2. PIX MODAL */}
      <Modal isOpen={activeModal === 'pix'} onClose={() => setActiveModal(null)} title="Enviar Chave Pix">
          <div className="space-y-4">
              <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Tipo de Chave</label>
                  <select value={pixType} onChange={e => setPixType(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-white">
                      <option value="cpf">CPF/CNPJ</option>
                      <option value="email">Email</option>
                      <option value="phone">Celular</option>
                      <option value="random">Aleatória</option>
                  </select>
              </div>
              <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Chave</label>
                  <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="Digite a chave..." />
              </div>
              <Button onClick={handleSendPix} className="w-full bg-green-600 hover:bg-green-500 text-white">Enviar Pix</Button>
          </div>
      </Modal>

      {/* 3. CONTACT MODAL */}
      <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title="Enviar Contato">
          <div className="space-y-4">
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome do Contato" />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Telefone (ex: 5511999999999)" />
              <Button onClick={handleSendContact} className="w-full">Enviar Cartão de Contato</Button>
          </div>
      </Modal>

      {/* 4. LOCATION MODAL */}
      <Modal isOpen={activeModal === 'location'} onClose={() => setActiveModal(null)} title="Enviar Localização">
          <div className="space-y-4 text-center py-4">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">Deseja enviar sua localização atual?</p>
              <p className="text-xs text-zinc-600">(O navegador solicitará permissão)</p>
              <Button onClick={handleSendLocation} className="w-full mt-4">Confirmar e Enviar</Button>
          </div>
      </Modal>

    </div>
  );
}