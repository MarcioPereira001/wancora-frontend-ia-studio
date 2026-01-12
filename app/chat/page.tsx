'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message, Instance } from '@/types';
import { cleanJid, cn } from '@/lib/utils';
import { 
    Loader2, Search, Send, Paperclip, Sparkles, Mic, Bot, 
    Image as IconImage, FileText, BarChart2, X, Trash2, ArrowLeft, User, Smartphone
} from 'lucide-react';
import { MessageBubble } from '@/components/chat/MessageBubble';
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

  // Busca instâncias disponíveis
  useEffect(() => {
      const fetchInstances = async () => {
          const { data } = await supabase.from('instances').select('*').eq('status', 'connected');
          if (data && data.length > 0) {
              setInstances(data);
              // Seleciona a primeira automaticamente se não tiver selecionado
              if (!selectedInstance) setSelectedInstance(data[0]);
          }
      };
      if (user?.company_id) fetchInstances();
  }, [user?.company_id]);

  // --- HOOK DE CHAT (VINCULADO À INSTÂNCIA SELECIONADA) ---
  const { contacts, loading: loadingContacts } = useChatList(selectedInstance?.session_id || null);
  
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);

  // States de Mídia e Utilitários
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

  useEffect(() => {
    // Verifica status da instância selecionada
    if (selectedInstance) {
        const check = async () => {
            const status = await whatsappService.getInstanceStatus(selectedInstance.session_id);
            setIsDisconnected(status?.status !== 'connected');
        };
        check();
    }
  }, [selectedInstance]);

  // Carregar Mensagens ao clicar no contato
  useEffect(() => {
      if(!activeContact || !selectedInstance) return;
      
      const fetchMsgs = async () => {
          setLoadingMessages(true);
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('remote_jid', activeContact.remote_jid) 
            .eq('session_id', selectedInstance.session_id) // <--- FILTRO DE INSTÂNCIA AQUI TAMBÉM
            .order('created_at', { ascending: true });
          
          setMessages(data || []);
          setLoadingMessages(false);
          setTimeout(scrollToBottom, 100);
      };

      fetchMsgs();

      const subscription = supabase
        .channel(`chat:${activeContact.remote_jid}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'messages',
            filter: `remote_jid=eq.${activeContact.remote_jid}`
        }, (payload) => {
            // Verifica se a mensagem nova pertence a esta sessão
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
  }, [activeContact, selectedInstance, supabase]);

  // Função de Envio
  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;

      const optimisticId = Date.now().toString();
      let contentPreview = payload.text || payload.caption || "";
      if(payload.type === 'poll') contentPreview = "📊 Enquete";
      if(payload.type === 'audio') contentPreview = payload.url;
      if(payload.type === 'image' || payload.type === 'video') contentPreview = payload.url;
      
      // UI Otimista
      const tempMsg: Message = {
          id: optimisticId,
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: contentPreview,
          body: contentPreview,
          message_type: payload.type || 'text',
          status: 'sending',
          created_at: new Date().toISOString(),
          session_id: selectedInstance.session_id, // Vincula à instância atual
          company_id: user.company_id,
          media_url: payload.url 
      } as any;

      setMessages(prev => [...prev, tempMsg]);
      setTimeout(scrollToBottom, 50);

      try {
          await api.post('/message/send', {
              sessionId: selectedInstance.session_id, // Envia pela instância selecionada
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
          console.error(error);
      }
  };

  const handleSendText = () => {
      if(!input.trim()) return;
      dispatchMessage({ type: 'text', text: input });
      setInput("");
  };

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

          await dispatchMessage({
              type,
              url: publicUrl,
              fileName: fileName,
              caption: input,
              mimetype: file.type
          });
          
          setInput(""); 

      } catch (error: any) {
          addToast({ type: 'error', title: 'Falha', message: error.message });
      } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
              const audioFile = new File([audioBlob], `ptt-${Date.now()}.mp3`, { type: 'audio/mp3' });
              
              if(user?.company_id) {
                  try {
                      addToast({ type: 'info', title: 'Enviando Áudio...', message: 'Processando...' });
                      const { publicUrl } = await uploadChatMedia(audioFile, user.company_id);
                      await dispatchMessage({
                          type: 'audio',
                          url: publicUrl,
                          ptt: true
                      });
                  } catch (e) {
                      addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar áudio.' });
                  }
              }
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      } catch (e) {
          addToast({ type: 'error', title: 'Erro', message: 'Microfone não acessível.' });
      }
  };

  const stopRecording = (cancel = false) => {
      if (mediaRecorderRef.current && isRecording) {
          if (cancel) audioChunksRef.current = [];
          mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreatePoll = () => {
      if(!pollQuestion || pollOptions.some(o => !o.trim())) {
          addToast({ type: 'warning', title: 'Atenção', message: 'Preencha a pergunta e as opções.' });
          return;
      }
      
      dispatchMessage({
          type: 'poll',
          name: pollQuestion,
          options: pollOptions
      });

      setPollModalOpen(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
  };

  const handleSmartReply = async () => {
      if(messages.length === 0) return;
      setIsAiLoading(true);
      try {
          const history = messages.slice(-10).map(m => 
            `${m.from_me ? 'Atendente' : 'Cliente'}: ${m.body || m.content}`
          ).join('\n');

          const result = await generateSmartReplyAction(history);
          if (result.error) throw new Error(result.error);
          setInput(result.text || "");
          addToast({ type: 'success', title: 'IA', message: 'Sugestão gerada.' });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro IA', message: 'Falha ao processar.' });
      } finally {
          setIsAiLoading(false);
      }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      
      {/* Sidebar */}
      <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm", activeContact ? "hidden md:flex" : "flex")}>
        
        {/* SELETOR DE INSTÂNCIA (NOVO) */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80">
            <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-4 h-4 text-primary" />
                <select 
                    className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-md p-2 focus:ring-primary focus:border-primary outline-none"
                    value={selectedInstance?.session_id || ''}
                    onChange={(e) => {
                        const inst = instances.find(i => i.session_id === e.target.value);
                        setSelectedInstance(inst || null);
                        setActiveContact(null); // Reseta chat ativo ao mudar instância
                    }}
                >
                    <option value="" disabled>Selecione uma Conexão</option>
                    {instances.map(inst => (
                        <option key={inst.session_id} value={inst.session_id}>
                            {inst.name || `WhatsApp ${inst.session_id.slice(0,4)}`}
                        </option>
                    ))}
                </select>
            </div>

            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <input 
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white placeholder-zinc-600 transition-all"
                    placeholder="Buscar na instância..."
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingContacts ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : contacts.length > 0 ? contacts.map(contact => (
                <div 
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    className={`p-4 border-b border-zinc-800/30 cursor-pointer transition-all hover:bg-zinc-800/50 ${activeContact?.id === contact.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden">
                                {contact.profile_pic_url ? (
                                    <img src={contact.profile_pic_url} alt={contact.name} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5 text-zinc-500" />
                                )}
                             </div>
                             <div className="min-w-0">
                                <span className={`font-medium truncate block ${activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200'}`}>
                                    {contact.name}
                                </span>
                                <p className="text-xs text-zinc-500 truncate">{contact.last_message || 'Inicie a conversa'}</p>
                             </div>
                        </div>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap pt-1">
                            {contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                    </div>
                </div>
             )) : (
                 <div className="p-8 text-center text-zinc-500 text-sm">
                    {selectedInstance ? "Nenhuma conversa nesta instância." : "Selecione uma conexão acima."}
                 </div>
             )}
        </div>
      </div>

      {/* Área do Chat */}
      <div className={cn("flex-1 flex-col bg-[#09090b] relative", activeContact ? "flex" : "hidden md:flex")}>
        {activeContact ? (
            <>
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-zinc-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={() => setActiveContact(null)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden">
                             {activeContact.profile_pic_url ? (
                                <img src={activeContact.profile_pic_url} alt={activeContact.name} className="w-full h-full object-cover" />
                             ) : (
                                <User className="w-5 h-5 text-zinc-500" />
                             )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white flex items-center gap-2 truncate">
                                {activeContact.name}
                                {isDisconnected && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 rounded-full border border-red-500/20">Offline</span>}
                            </h3>
                            <p className="text-xs text-zinc-400 font-mono tracking-wide truncate">{cleanJid(activeContact.remote_jid)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}>
                    {loadingMessages ? (
                        <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
                    ) : messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[85%] md:max-w-[75%] px-3 py-2 shadow-sm text-sm relative group ${
                                msg.from_me 
                                    ? 'bg-primary/10 text-primary-foreground border border-primary/20 rounded-2xl rounded-tr-sm' 
                                    : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-2xl rounded-tl-sm'
                            }`}>
                                <MessageBubble message={msg} />
                                <div className={`flex justify-end mt-1 text-[9px] items-center gap-1 ${msg.from_me ? 'text-primary/60' : 'text-zinc-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                    {msg.from_me && (
                                        <span>
                                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur relative">
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSmartReply}
                            disabled={isAiLoading || messages.length === 0}
                            className="text-xs h-7 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap"
                        >
                            {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                            IA Sugerir
                        </Button>
                    </div>

                    <div className="flex items-end gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all shadow-inner relative">
                        <div className="relative">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={`h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 ${mediaMenuOpen ? 'text-primary bg-primary/10' : ''}`}
                                onClick={() => setMediaMenuOpen(!mediaMenuOpen)}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>

                            {mediaMenuOpen && (
                                <div className="absolute bottom-12 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 flex flex-col gap-1 w-48 animate-in slide-in-from-bottom-2 z-50">
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                                        <IconImage className="w-4 h-4 text-purple-400" /> Imagem/Vídeo
                                        <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                                    </label>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
                                        <FileText className="w-4 h-4 text-blue-400" /> Documento
                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileUpload} />
                                    </label>
                                    <button onClick={() => { setMediaMenuOpen(false); setPollModalOpen(true); }} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors w-full text-left">
                                        <BarChart2 className="w-4 h-4 text-yellow-400" /> Enquete
                                    </button>
                                </div>
                            )}
                        </div>

                        <textarea 
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 resize-none py-2 max-h-32 custom-scrollbar" 
                            placeholder={isRecording ? "Gravando áudio..." : "Digite uma mensagem..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendText();
                                }
                            }}
                            disabled={isDisconnected || isRecording}
                            rows={1}
                        />

                        {isRecording ? (
                            <div className="flex items-center gap-2 animate-in fade-in">
                                <span className="text-red-500 font-mono text-xs animate-pulse">● {formatTime(recordingTime)}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => stopRecording(true)} 
                                    className="h-9 w-9 text-red-500 hover:bg-red-500/10"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                                <Button 
                                    size="icon" 
                                    onClick={() => stopRecording(false)} 
                                    className="h-9 w-9 bg-green-600 hover:bg-green-500 text-white rounded-full"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <>
                                {!input.trim() && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                                        onClick={startRecording}
                                    >
                                        <Mic className="h-5 w-5" />
                                    </Button>
                                )}
                                <Button 
                                    size="icon" 
                                    className={`h-9 w-9 transition-transform ${input.trim() ? 'scale-100' : 'scale-0 w-0 p-0 opacity-0'}`}
                                    onClick={handleSendText}
                                    disabled={!input.trim() || isDisconnected}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                    <input type="file" className="hidden" ref={fileInputRef} />
                </div>
            </>
        ) : (
            <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20 p-4 text-center">
                <Smartphone className="h-12 w-12 text-zinc-700 mb-4 animate-bounce" />
                <h3 className="text-lg font-medium text-zinc-300">Wancora CRM</h3>
                <p className="text-sm opacity-60 mt-1">Selecione uma instância e um contato para conversar.</p>
            </div>
        )}
      </div>

      {/* Modal Criar Enquete */}
      <Modal isOpen={pollModalOpen} onClose={() => setPollModalOpen(false)} title="Nova Enquete">
          <div className="space-y-4">
              <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase">Pergunta</label>
                  <Input 
                    value={pollQuestion} 
                    onChange={e => setPollQuestion(e.target.value)} 
                    placeholder="Ex: Qual o melhor horário?" 
                    className="mt-1"
                  />
              </div>
              <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Opções</label>
                  <div className="space-y-2">
                      {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex gap-2">
                              <Input 
                                value={opt} 
                                onChange={e => {
                                    const newOpts = [...pollOptions];
                                    newOpts[idx] = e.target.value;
                                    setPollOptions(newOpts);
                                }}
                                placeholder={`Opção ${idx + 1}`}
                              />
                              {pollOptions.length > 2 && (
                                  <Button variant="ghost" size="icon" onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}>
                                      <X className="w-4 h-4 text-zinc-500" />
                                  </Button>
                              )}
                          </div>
                      ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-xs border-dashed border-zinc-700 w-full"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                  >
                      + Adicionar Opção
                  </Button>
              </div>
              <div className="flex justify-end pt-4">
                  <Button onClick={handleCreatePoll} className="w-full">Criar e Enviar</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}