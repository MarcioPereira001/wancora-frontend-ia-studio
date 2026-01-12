'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message, Instance, Lead } from '@/types';
import { cleanJid, cn } from '@/lib/utils';
import { 
    Loader2, Search, Send, Paperclip, Sparkles, Mic, Bot, 
    Image as IconImage, FileText, BarChart2, X, Trash2, ArrowLeft, User, Smartphone, Wifi, Clock
} from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatSidebar } from '@/components/chat/ChatSidebar'; // IMPORTADO
import { MessageScheduler } from '@/components/chat/MessageScheduler'; // IMPORTADO
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { generateSmartReplyAction } from '@/app/actions/gemini';
import { useToast } from '@/hooks/useToast';
import { whatsappService } from '@/services/whatsappService';
import { api } from '@/services/api';
import { useChatList } from '@/hooks/useChatList';
import { uploadChatMedia } from '@/utils/supabase/storage';

export default function ChatPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  // --- ESTADOS DE INSTÂNCIA ---
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);

  // Busca instâncias disponíveis apenas conectadas
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

  // --- HOOK DE CHAT ---
  const { contacts, loading: loadingContacts } = useChatList(selectedInstance?.session_id || null);
  
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null); // State para o Lead Atual
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Scheduler State
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  // States de Mídia
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Carregar Mensagens e LEAD ao clicar no contato
  useEffect(() => {
      if(!activeContact || !selectedInstance) {
          setActiveLead(null);
          return;
      }
      
      const fetchData = async () => {
          setLoadingMessages(true);
          
          // 1. Mensagens
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('remote_jid', activeContact.remote_jid) 
            .eq('session_id', selectedInstance.session_id) 
            .eq('company_id', user?.company_id)
            .order('created_at', { ascending: true });
          
          setMessages(msgs || []);
          
          // 2. Lead Data (Por telefone)
          // Normaliza telefone (remove sufixo do JID)
          const cleanPhone = activeContact.remote_jid.split('@')[0];
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user?.company_id)
            .ilike('phone', `%${cleanPhone}%`) // Busca flexível
            .limit(1)
            .maybeSingle();
            
          setActiveLead(lead);

          setLoadingMessages(false);
          setTimeout(scrollToBottom, 100);
      };

      fetchData();

      const subscription = supabase
        .channel(`chat:${activeContact.remote_jid}:${selectedInstance.session_id}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages',
            filter: `remote_jid=eq.${activeContact.remote_jid}`
        }, (payload) => {
            if (payload.new && (payload.new as any).session_id === selectedInstance.session_id) {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new as Message];
                    });
                    setTimeout(scrollToBottom, 100);
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m));
                }
            }
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };
  }, [activeContact, selectedInstance, supabase, user?.company_id]);

  // Função para recarregar o Lead após alterações na Sidebar
  const refreshLeadData = async () => {
      if(!activeContact || !user?.company_id) return;
      const cleanPhone = activeContact.remote_jid.split('@')[0];
      const { data } = await supabase.from('leads').select('*').eq('company_id', user.company_id).ilike('phone', `%${cleanPhone}%`).maybeSingle();
      setActiveLead(data);
  };

  // Função de Envio
  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;

      const optimisticId = Date.now().toString();
      let contentPreview = payload.text || payload.caption || "";
      if(payload.type === 'poll') contentPreview = "📊 Enquete";
      if(payload.type === 'audio') contentPreview = payload.url;
      if(payload.type === 'image' || payload.type === 'video') contentPreview = payload.url;
      
      const tempMsg: Message = {
          id: optimisticId,
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: contentPreview,
          body: contentPreview,
          message_type: payload.type || 'text',
          status: 'sending',
          created_at: new Date().toISOString(),
          session_id: selectedInstance.session_id,
          company_id: user.company_id,
          media_url: payload.url 
      } as any;

      setMessages(prev => [...prev, tempMsg]);
      setTimeout(scrollToBottom, 50);

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
              name: payload.name        
          });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar mensagem.' });
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
      }
  };

  const handleSendText = () => {
      if(!input.trim()) return;
      dispatchMessage({ type: 'text', text: input });
      setInput("");
  };

  const handleScheduleMessage = async (content: string, date: Date) => {
      if (!user?.company_id || !selectedInstance || !activeContact) return;
      
      try {
          const { error } = await supabase.from('scheduled_messages').insert({
              company_id: user.company_id,
              lead_id: activeLead?.id,
              contact_jid: activeContact.remote_jid,
              session_id: selectedInstance.session_id,
              content: content,
              scheduled_at: date.toISOString(),
              status: 'pending'
          });

          if(error) throw error;
          addToast({ type: 'success', title: 'Agendado', message: 'Mensagem programada com sucesso.' });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      }
  };

  // ... (Manter funções handleFileUpload, startRecording, etc. iguais ao anterior) ...
  // [CÓDIGO OMITIDO PARA BREVIDADE - MANTENHA A LÓGICA DE MÍDIA E GRAVAÇÃO DO CÓDIGO ORIGINAL]
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id) return;
      setMediaMenuOpen(false);
      addToast({ type: 'info', title: 'Enviando...', message: 'Fazendo upload.' });
      try {
          const { publicUrl, fileName } = await uploadChatMedia(file, user.company_id);
          let type = 'document';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) type = 'audio';
          await dispatchMessage({ type, url: publicUrl, fileName: fileName, caption: input, mimetype: file.type });
          setInput(""); 
      } catch (error: any) {
          addToast({ type: 'error', title: 'Falha', message: error.message });
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };
  const startRecording = async () => { /* ... Lógica existente ... */ };
  const stopRecording = (cancel = false) => { /* ... Lógica existente ... */ setIsRecording(false); }; // Mocked for brevity
  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  const handleCreatePoll = () => { /* ... Lógica existente ... */ setPollModalOpen(false); };
  const handleSmartReply = async () => { /* ... Lógica existente ... */ };

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* 1. Sidebar Esquerda (Lista de Chats) */}
      <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm", activeContact ? "hidden md:flex" : "flex")}>
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
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white" placeholder="Buscar conversa..." />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingContacts ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div> : 
             contacts.map(contact => (
                <div key={contact.id} onClick={() => setActiveContact(contact)} className={`p-4 border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 ${activeContact?.id === contact.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden">
                                {contact.profile_pic_url ? <img src={contact.profile_pic_url} className="w-full h-full object-cover" /> : <span className="text-zinc-500 font-bold">{contact.name?.charAt(0) || 'U'}</span>}
                             </div>
                             <div className="min-w-0">
                                <span className={`font-medium truncate block ${activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200'}`}>{contact.name}</span>
                                <p className="text-xs text-zinc-500 truncate">{contact.last_message}</p>
                             </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 pt-1">{contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                </div>
             ))}
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
                             {activeContact.profile_pic_url ? <img src={activeContact.profile_pic_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-zinc-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{activeContact.name}</h3>
                            <p className="text-xs text-zinc-400 font-mono">{cleanJid(activeContact.remote_jid)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}>
                    {loadingMessages ? <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div> : 
                     messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-2 shadow-sm text-sm relative group ${msg.from_me ? 'bg-primary/10 text-primary-foreground border border-primary/20 rounded-2xl rounded-tr-sm' : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-2xl rounded-tl-sm'}`}>
                                <MessageBubble message={msg} />
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

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
                            <Button variant="ghost" size="icon" className={cn("h-9 w-9 hover:text-white transition-colors", isSchedulerOpen ? "text-purple-500 bg-purple-500/10" : "text-zinc-400")} onClick={() => setIsSchedulerOpen(!isSchedulerOpen)}>
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
            </>
        ) : (
            <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20 p-4 text-center">
                <Smartphone className="h-12 w-12 text-zinc-700 mb-4 animate-bounce" />
                <h3 className="text-lg font-medium text-zinc-300">Wancora CRM</h3>
                <p className="text-sm opacity-60">Selecione uma conexão.</p>
            </div>
        )}
      </div>

      {/* 3. Sidebar Direita (Lead Command Center) */}
      {activeContact && selectedInstance && (
          <ChatSidebar 
            contact={activeContact} 
            lead={activeLead} 
            refreshLead={refreshLeadData} 
          />
      )}

      {/* Modals */}
      <Modal isOpen={pollModalOpen} onClose={() => setPollModalOpen(false)} title="Nova Enquete">
          {/* ... Código do modal de enquete (igual ao original) ... */}
          <div className="space-y-4">
              <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Pergunta" />
              <Button onClick={handleCreatePoll} className="w-full">Criar</Button>
          </div>
      </Modal>
    </div>
  );
}