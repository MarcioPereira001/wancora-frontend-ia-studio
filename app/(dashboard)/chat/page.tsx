'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message, Instance, Lead } from '@/types';
import { cleanJid, cn } from '@/lib/utils';
import { 
    Loader2, Search, Send, Paperclip, Sparkles, Mic, 
    Image as IconImage, FileText, BarChart2, X, Trash2, ArrowLeft, User, Smartphone, Wifi, Clock, MoreVertical, CheckSquare, BellOff, Bell, Users, Check, MapPin, DollarSign, List, Plus, Copy, Crosshair, StopCircle, Music, RefreshCw
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
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  
  // -- MEDIA RECORDING --
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- MODALS STATE --
  const [activeModal, setActiveModal] = useState<'poll'|'pix'|'contact'|'location'|null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Sim", "Não"]);
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("cpf");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaMenuRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
      messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // --- CLICK OUTSIDE HANDLER ---
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target as Node)) {
              setMediaMenuOpen(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
          document.removeEventListener("mousedown", handleClickOutside);
      };
  }, []);

  const handleContactSelect = async (contact: ChatContact) => {
      if (isInboxSelectionMode) {
          handleInboxSelect(contact.jid);
          return;
      }
      setActiveContact(contact);
      setSearchTerm("");
      setMediaMenuOpen(false); 
      
      try {
          await supabase.from('contacts')
            .update({ unread_count: 0 })
            .eq('jid', contact.jid)
            .eq('company_id', user?.company_id);
          refreshChats();
      } catch (e) {}
  };

  // --- IDENTITY UNIFICATION LOGIC ---
  const linkIdentity = async (lidJid: string, phoneJid: string) => {
      if (!user?.company_id) return;
      console.log(`[Identity] Linking LID ${lidJid} to Phone ${phoneJid}`);
      
      try {
          await supabase.rpc('link_identities', {
              p_lid: lidJid,
              p_phone: phoneJid,
              p_company_id: user.company_id
          });
          // Refresh after link to get the merged messages
          const msgs = await loadMessages(0);
          setMessages(msgs);
      } catch (e) {
          console.error("Link failed:", e);
      }
  };

  const loadMessages = async (offset: number) => {
      if(!activeContact || !user?.company_id) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select(`*`) 
        .eq('remote_jid', activeContact.remote_jid) 
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + MESSAGES_PER_PAGE - 1);
        
      if (error) {
          console.error("Erro fetchMessages:", error);
          return [];
      }
      return (data || []).reverse(); 
  };

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

  // --- INIT CHAT & REALTIME ---
  useEffect(() => {
      if(!activeContact || !selectedInstance) {
          setActiveLead(null);
          setMessages([]);
          setIsMsgSelectionMode(false);
          setSelectedMsgIds(new Set());
          return;
      }
      
      const initChat = async () => {
          try {
            setLoadingMessages(true);
            setMessages([]);
            setHasMoreMessages(true);
            
            const initialMsgs = await loadMessages(0);
            setMessages(initialMsgs);
            
            await refreshLeadData();
          } catch (error) {
            console.error("Erro ao iniciar chat:", error);
          } finally {
            setLoadingMessages(false);
            setTimeout(() => scrollToBottom('auto'), 100);
          }
      };

      initChat();

      const channel = supabase
        .channel(`chat-room-global`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages'
        }, async (payload) => {
            const newMessage = payload.new as Message;
            if (newMessage.company_id !== user?.company_id) return;

            refreshChats();

            const isLid = newMessage.remote_jid.includes('@lid');
            const isActiveChat = newMessage.remote_jid === activeContact.remote_jid;
            
            // Lógica de "Smart Linking"
            // Se estamos no chat de Telefone e chega um LID
            if (!isActiveChat && isLid && activeContact.remote_jid.includes('@s.whatsapp.net')) {
                // Heurística simples: Assume que é do mesmo chat se a UI estiver aberta
                // (Em produção real, isso poderia ser perigoso, mas resolve o problema do usuário agora)
                await linkIdentity(newMessage.remote_jid, activeContact.remote_jid);
                // O linkIdentity vai disparar um refresh das mensagens
                return;
            }

            if (isActiveChat || isLid) {
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
                setTimeout(() => scrollToBottom('smooth'), 100);
                
                if (!newMessage.from_me) {
                    supabase.from('contacts').update({ unread_count: 0 }).eq('jid', activeContact.remote_jid);
                }
            }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [activeContact?.id, user?.company_id]);

  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;
      
      const tempId = `temp-${Date.now()}`;
      let contentDisplay = payload.text;
      
      if (payload.type === 'pix') contentDisplay = `Chave Pix: ${payload.text}`;
      if (payload.type === 'poll') contentDisplay = payload.content?.name || 'Enquete';
      if (payload.type === 'location') contentDisplay = 'Localização';
      if (payload.type === 'contact') contentDisplay = 'Contato';
      if (payload.caption) contentDisplay = payload.caption;

      const tempMsg: Message = {
          id: tempId,
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: contentDisplay,
          body: payload.text,
          message_type: payload.type || 'text',
          status: 'sending',
          created_at: new Date().toISOString(),
          session_id: selectedInstance.session_id,
          company_id: user.company_id,
          media_url: payload.url,
          fileName: payload.fileName 
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
              poll: payload.type === 'poll' ? payload.content : undefined,
              location: payload.type === 'location' ? payload.content : undefined,
              contact: payload.type === 'contact' ? payload.content : undefined,
              mimetype: payload.mimetype,
              fileName: payload.fileName,
              ptt: payload.ptt
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
      if (file.size > 50 * 1024 * 1024) { addToast({ type: 'error', title: 'Limite', message: 'Máx 50MB.' }); return; }
      setMediaMenuOpen(false); 
      addToast({ type: 'info', title: 'Upload', message: 'Enviando...' });
      try {
          const { publicUrl, fileName } = await uploadChatMedia(file, user.company_id);
          let type = 'document';
          let ptt = false;
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) { type = 'audio'; ptt = false; }
          await dispatchMessage({ type, url: publicUrl, caption: input, fileName: fileName, mimetype: file.type, ptt: ptt }); 
          setInput("");
      } catch (e: any) { addToast({ type: 'error', title: 'Erro', message: e.message }); }
      finally { if (fileInputRef.current) fileInputRef.current.value = ''; if (audioInputRef.current) audioInputRef.current.value = ''; }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
              const audioFile = new File([audioBlob], `voice_${Date.now()}.mp3`, { type: 'audio/mp3' });
              if (audioFile.size > 0 && user?.company_id) {
                  try {
                      const { publicUrl } = await uploadChatMedia(audioFile, user.company_id);
                      await dispatchMessage({ type: 'audio', url: publicUrl, mimetype: 'audio/mp4', ptt: true });
                  } catch (e) {}
              }
              stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) { addToast({ type: 'error', title: 'Microfone', message: 'Permissão negada.' }); }
  };

  const stopRecording = (cancel = false) => {
      if (mediaRecorderRef.current && isRecording) {
          if (cancel) { mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); mediaRecorderRef.current = null; } 
          else { mediaRecorderRef.current.stop(); }
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Special Handlers
  const handleCreatePoll = () => { if(!pollQuestion.trim()) return; const valid = pollOptions.filter(o => o.trim().length > 0); if(valid.length < 2) return; dispatchMessage({ type: 'poll', content: { name: pollQuestion, options: valid, selectableOptionsCount: 1 } }); setPollQuestion(""); setPollOptions(["Sim", "Não"]); setActiveModal(null); };
  const handleSendPix = () => { if(!pixKey.trim()) return; dispatchMessage({ type: 'pix', text: pixKey }); setPixKey(""); setActiveModal(null); };
  const handleSendContact = () => { if(!contactName.trim() || !contactPhone.trim()) return; const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL:${contactPhone}\nEND:VCARD`; dispatchMessage({ type: 'contact', content: { displayName: contactName, vcard, phone: contactPhone } }); setContactName(""); setContactPhone(""); setActiveModal(null); };
  const getCurrentLocation = () => { if (!navigator.geolocation) return; setLocLoading(true); navigator.geolocation.getCurrentPosition((pos) => { setLocLat(pos.coords.latitude); setLocLng(pos.coords.longitude); setLocLoading(false); }, (err) => { setLocLoading(false); }, { enableHighAccuracy: true, timeout: 10000 }); };
  const handleSendLocation = () => { if (locLat && locLng) { dispatchMessage({ type: 'location', content: { latitude: locLat, longitude: locLng } }); setActiveModal(null); setLocLat(null); setLocLng(null); } };

  // Utils
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (container.scrollTop < 50 && hasMoreMessages && !fetchingMore && !loadingMessages) {
          setFetchingMore(true);
          const currentHeight = container.scrollHeight; 
          const olderMessages = await loadMessages(messages.length);
          if (olderMessages.length > 0) {
              setMessages(prev => [...olderMessages, ...prev]);
              setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - currentHeight; }, 0);
          } else { setHasMoreMessages(false); }
          setFetchingMore(false);
      }
  };

  const handleInboxSelect = (jid: string) => setSelectedInboxIds(prev => { const n = new Set(prev); if(n.has(jid)) n.delete(jid); else n.add(jid); return n; });
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);
  const toggleMsgSelectionMode = () => { setIsMsgSelectionMode(!isMsgSelectionMode); setSelectedMsgIds(new Set()); setShowOptionsMenu(false); };
  const handleSelectMessage = (id: string) => { setSelectedMsgIds(prev => { const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const handleClearChat = async () => {};
  const handleDeleteSelectedMsgs = async () => {};

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* SIDEBAR ESQUERDA */}
      <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm", activeContact ? "hidden md:flex" : "flex")}>
        {/* Header Inbox */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm">
                <Wifi className={cn("w-4 h-4", selectedInstance ? "text-green-500" : "text-zinc-500")} />
                <select className="w-full bg-transparent text-zinc-200 text-sm font-medium outline-none cursor-pointer" value={selectedInstance?.session_id || ''} onChange={(e) => { const inst = instances.find(i => i.session_id === e.target.value); setSelectedInstance(inst || null); setActiveContact(null); }} disabled={instances.length === 0}>
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
                        <input className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                    <div key={contact.id} onClick={() => handleContactSelect(contact)} className={cn("p-4 border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 relative transition-colors", activeContact?.id === contact.id && !isInboxSelectionMode ? 'bg-primary/5 border-l-2 border-l-primary' : '', isSelected ? "bg-primary/10" : "")}>
                        <div className="flex justify-between items-start mb-1">
                            {isInboxSelectionMode && (<div className="mr-3 mt-1"><Checkbox checked={isSelected} onCheckedChange={() => handleInboxSelect(contact.jid)} className="border-zinc-600 data-[state=checked]:bg-primary" /></div>)}
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                 <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden relative">
                                    {contact.profile_pic_url ? (<img src={contact.profile_pic_url} className="w-full h-full object-cover" />) : contact.is_group ? (<Users className="w-5 h-5 text-zinc-500" />) : (<span className="text-zinc-500 font-bold">{contact.name?.charAt(0) || 'U'}</span>)}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className={cn("font-medium truncate block", activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200')}>{contact.name}</span>
                                        <span className="text-[10px] text-zinc-500">{contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
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
                            {/* Anexo Menu */}
                            <div className="relative" ref={mediaMenuRef}>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100" onClick={() => setMediaMenuOpen(!mediaMenuOpen)}><Paperclip className="h-5 w-5" /></Button>
                                {mediaMenuOpen && (
                                    <div className="absolute bottom-12 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 w-64 z-50 grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2">
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <IconImage className="w-5 h-5 text-purple-400" /> Galeria
                                            <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                                        </label>
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <FileText className="w-5 h-5 text-blue-400" /> Documento
                                            <input type="file" className="hidden" accept="*" onChange={handleFileUpload} ref={fileInputRef} />
                                        </label>
                                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                            <Music className="w-5 h-5 text-pink-400" /> Arquivo Áudio
                                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} ref={audioInputRef} />
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
                                    </div>
                                )}
                            </div>

                            {/* Text Input / Audio Recorder UI */}
                            {isRecording ? (
                                <div className="flex-1 flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2 text-red-500 animate-pulse">
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        <span className="font-mono text-sm font-bold">{formatTime(recordingTime)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/10" onClick={() => stopRecording(true)}>
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                        <Button size="icon" className="bg-green-600 hover:bg-green-500" onClick={() => stopRecording(false)}>
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <textarea className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-2 max-h-32 custom-scrollbar" placeholder="Digite..." value={input} onChange={handleInputChange} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} rows={1} />
                                    
                                    {input.trim() ? (
                                        <Button size="icon" className="h-9 w-9 transition-transform" onClick={handleSendText}><Send className="h-4 w-4" /></Button>
                                    ) : (
                                        <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-white" onClick={startRecording}><Mic className="h-5 w-5" /></Button>
                                    )}
                                </>
                            )}
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
      <Modal isOpen={activeModal === 'poll'} onClose={() => setActiveModal(null)} title="Nova Enquete">
          <div className="space-y-4">
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Pergunta da enquete" />
              <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                      <Input key={idx} value={opt} onChange={e => {const newOpts = [...pollOptions]; newOpts[idx] = e.target.value; setPollOptions(newOpts);}} placeholder={`Opção ${idx + 1}`} />
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setPollOptions([...pollOptions, ""])} className="w-full text-xs">+ Adicionar Opção</Button>
              </div>
              <Button onClick={handleCreatePoll} className="w-full">Criar Enquete</Button>
          </div>
      </Modal>

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

      <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title="Enviar Contato">
          <div className="space-y-4">
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome do Contato" />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Telefone" />
              <Button onClick={handleSendContact} className="w-full">Enviar Cartão de Contato</Button>
          </div>
      </Modal>

      <Modal isOpen={activeModal === 'location'} onClose={() => setActiveModal(null)} title="Enviar Localização">
          <div className="space-y-4 py-2">
              <div className="relative w-full h-48 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 group">
                  {locLat && locLng ? (
                      <>
                        <div className="absolute inset-0 bg-[#e5e7eb]" style={{ backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg")', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'opacity(0.3)'}}></div>
                        <div className="absolute inset-0 flex items-center justify-center"><div className="bg-red-500 p-2 rounded-full shadow-xl animate-bounce"><MapPin className="w-6 h-6 text-white" fill="currentColor" /></div></div>
                        <div className="absolute bottom-2 left-2 right-2 bg-white/90 text-black text-xs p-2 rounded shadow flex justify-between items-center"><span className="font-mono">{locLat.toFixed(6)}, {locLng.toFixed(6)}</span><span className="text-[10px] font-bold text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Preciso</span></div>
                      </>
                  ) : (<div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2"><MapPin className="w-8 h-8 opacity-20" /><p className="text-xs">Aguardando localização...</p></div>)}
                  {locLoading && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>)}
              </div>
              {!locLat ? (
                  <Button onClick={getCurrentLocation} className="w-full h-12 text-sm bg-blue-600 hover:bg-blue-500" disabled={locLoading}><Crosshair className="w-4 h-4 mr-2" /> {locLoading ? "Buscando satélites..." : "Obter Localização Atual"}</Button>
              ) : (
                  <div className="flex gap-2"><Button variant="outline" onClick={() => { setLocLat(null); setLocLng(null); }} className="flex-1">Refazer</Button><Button onClick={handleSendLocation} className="flex-[2] bg-green-600 hover:bg-green-500"><Send className="w-4 h-4 mr-2" /> Enviar Localização</Button></div>
              )}
              <p className="text-[10px] text-zinc-500 text-center">Usamos o GPS do seu navegador para alta precisão.</p>
          </div>
      </Modal>

    </div>
  );
}