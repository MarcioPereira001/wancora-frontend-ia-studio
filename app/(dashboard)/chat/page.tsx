'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ChatContact, Message } from '@/types';
import { cleanJid } from '@/lib/utils';
import { Loader2, Search, Send, Paperclip, Sparkles, Mic, Phone, Video, Bot } from 'lucide-react';
import { MessageContent } from '@/components/chat/MessageContent';
import { Button } from '@/components/ui/button';
import { generateSmartReplyAction } from '@/app/actions/gemini';
import { useToast } from '@/hooks/useToast';
import { whatsappService } from '@/services/whatsappService';
import { api } from '@/services/api';
import { useChatList } from '@/hooks/useChatList';

export default function ChatPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  // Usando o Hook Otimizado
  const { contacts, loading: loadingContacts } = useChatList();
  
  const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const check = async () => {
        const status = await whatsappService.getInstanceStatus();
        setIsDisconnected(status?.status !== 'connected');
    };
    check();
  }, []);

  useEffect(() => {
      if(!activeContact) return;
      
      const fetchMsgs = async () => {
          setLoadingMessages(true);
          const { data } = await supabase
            .from('messages')
            .select('*')
            // Importante: Filtrar também por company_id se messages tiver essa coluna, ou confiar no RLS
            .eq('remote_jid', activeContact.remote_jid) 
            .order('created_at', { ascending: true });
          
          setMessages(data || []);
          setLoadingMessages(false);
          setTimeout(scrollToBottom, 100);
      };

      fetchMsgs();

      const subscription = supabase
        .channel(`chat:${activeContact.remote_jid}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `remote_jid=eq.${activeContact.remote_jid}`
        }, (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
            setTimeout(scrollToBottom, 100);
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };

  }, [activeContact, supabase]);

  const handleSendMessage = async () => {
      if(!input.trim() || !activeContact) return;
      if(isDisconnected) {
          addToast({ type: 'warning', title: 'Offline', message: 'WhatsApp desconectado.' });
          return;
      }

      // Fix: Added missing properties (session_id, company_id, message_type) and fixed 'type' key to 'message_type'
      const tempMsg: Message = {
          id: Date.now().toString(),
          remote_jid: activeContact.remote_jid,
          from_me: true,
          content: input,
          body: input,
          message_type: 'text',
          status: 'sent',
          created_at: new Date().toISOString(),
          session_id: 'default',
          company_id: user?.company_id || ''
      };

      setMessages(prev => [...prev, tempMsg]);
      setInput("");
      setTimeout(scrollToBottom, 50);

      try {
          await api.post('/messages/send', {
              jid: activeContact.remote_jid,
              message: tempMsg.content
          });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao enviar mensagem.' });
      }
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
          addToast({ type: 'success', title: 'IA Wancora', message: 'Sugestão gerada com sucesso.' });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro IA', message: 'Falha ao processar no servidor.' });
      } finally {
          setIsAiLoading(false);
      }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      {/* Sidebar */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900/30 backdrop-blur-sm">
        <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Atendimentos</h2>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <input 
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white placeholder-zinc-600 transition-all"
                    placeholder="Buscar cliente..."
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingContacts ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : contacts.map(contact => (
                <div 
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    className={`p-4 border-b border-zinc-800/30 cursor-pointer transition-all hover:bg-zinc-800/50 ${activeContact?.id === contact.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className={`font-medium ${activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200'}`}>
                            {contact.name || cleanJid(contact.remote_jid)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                            {contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{contact.last_message || '...'}</p>
                </div>
             ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#09090b] relative">
        {activeContact ? (
            <>
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md z-10">
                    <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center text-sm font-bold border border-zinc-700">
                            {activeContact.name?.[0]}
                        </div>
                        <div className="ml-3">
                            <h3 className="font-medium text-white flex items-center gap-2">
                                {activeContact.name}
                                {isDisconnected && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 rounded-full border border-red-500/20">Offline</span>}
                            </h3>
                            <p className="text-xs text-zinc-400 font-mono tracking-wide">{cleanJid(activeContact.remote_jid)}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-800 rounded-full"><Phone className="w-4 h-4 text-zinc-400" /></Button>
                        <Button variant="ghost" size="icon" className="hover:bg-zinc-800 rounded-full"><Video className="w-4 h-4 text-zinc-400" /></Button>
                    </div>
                </div>

                <div 
                    className="flex-1 overflow-y-auto p-6 space-y-4"
                    style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}
                >
                    {loadingMessages ? (
                        <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col h-full items-center justify-center text-zinc-500 opacity-50">
                            <Bot className="w-12 h-12 mb-2" />
                            <p>Inicie a conversa</p>
                        </div>
                    ) : messages.map((msg, idx) => (
                        <div key={msg.id || idx} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[70%] px-4 py-2.5 shadow-sm text-sm relative group ${
                                msg.from_me 
                                    ? 'bg-primary/10 text-primary-foreground border border-primary/20 rounded-2xl rounded-tr-sm' 
                                    : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50 rounded-2xl rounded-tl-sm'
                            }`}>
                                <MessageContent message={msg} />
                                <div className={`flex justify-end mt-1 text-[10px] ${msg.from_me ? 'text-primary/60' : 'text-zinc-500'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur">
                    <div className="flex items-center gap-2 mb-3">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSmartReply}
                            disabled={isAiLoading || messages.length === 0}
                            className="text-xs h-8 gap-2 bg-primary/5 border-primary/20 hover:bg-primary/10 hover:text-primary transition-all"
                        >
                            {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-primary" />}
                            IA Sugerir Resposta
                        </Button>
                    </div>
                    <div className="flex items-end gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all shadow-inner">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <textarea 
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-zinc-600 resize-none py-2 max-h-32 custom-scrollbar" 
                            placeholder={isDisconnected ? "Conecte o WhatsApp para responder" : "Digite uma mensagem..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            disabled={isDisconnected}
                            rows={1}
                        />
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                            <Mic className="h-5 w-5" />
                        </Button>
                        <Button 
                            size="icon" 
                            className={`h-9 w-9 transition-transform ${input.trim() ? 'scale-100' : 'scale-90 opacity-70'}`}
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isDisconnected}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20">
                <div className="w-24 h-24 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mb-6 animate-pulse">
                    <Bot className="h-10 w-10 text-primary opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">Wancora CRM Chat</h3>
                <p className="text-sm opacity-60 mt-1">Selecione uma conversa para começar</p>
            </div>
        )}
      </div>
    </div>
  );
}