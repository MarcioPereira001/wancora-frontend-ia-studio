import React, { useState, useEffect, useRef } from 'react';
import { Contact, Message } from '../types';
import { Search, Phone, Video, MoreVertical, Paperclip, Mic, Send, Bot, Sparkles, Check, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { generateSmartReply } from '../services/geminiService';

const contactsMock: Contact[] = [
  { id: '1', name: 'Alice Freeman', number: '+1 234 567 890', lastMessage: 'Is the pricing negotiable?', lastMessageTime: '10:30 AM', unreadCount: 2, tags: ['Hot Lead'] },
  { id: '2', name: 'Tech Solutions Inc', number: '+1 987 654 321', lastMessage: 'Thanks for the quick response!', lastMessageTime: 'Yesterday', unreadCount: 0, tags: ['Customer'] },
  { id: '3', name: 'John Doe', number: '+1 555 123 456', lastMessage: 'Can we schedule a call?', lastMessageTime: 'Mon', unreadCount: 0, tags: ['Lead'] },
];

const initialMessages: Message[] = [
  { id: '1', content: 'Hi there! I saw your pricing page.', senderId: '1', timestamp: '10:00 AM', status: 'read', type: 'text' },
  { id: '2', content: 'Hello Alice! Yes, we have different tiers. Which one caught your eye?', senderId: 'me', timestamp: '10:05 AM', status: 'read', type: 'text' },
  { id: '3', content: 'The Professional plan. However, I have a small team. Is the pricing negotiable?', senderId: '1', timestamp: '10:30 AM', status: 'delivered', type: 'text' },
];

export const Inbox: React.FC = () => {
  const [selectedContact, setSelectedContact] = useState<Contact>(contactsMock[0]);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputText,
      senderId: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      type: 'text',
    };
    setMessages([...messages, newMessage]);
    setInputText('');
  };

  const handleMagicReply = async () => {
    setIsAiLoading(true);
    // Construct history for AI
    const history = messages.map(m => 
      `${m.senderId === 'me' ? 'Agent' : 'Customer'}: ${m.content}`
    ).join('\n');
    
    const reply = await generateSmartReply(history);
    setInputText(reply);
    setIsAiLoading(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-xl border border-border bg-card overflow-hidden shadow-2xl">
      {/* Contact List */}
      <div className="w-80 border-r border-border flex flex-col bg-zinc-950/50">
        <div className="p-4 border-b border-border bg-zinc-900/30">
            <h2 className="text-lg font-semibold mb-4">Inbox</h2>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                    type="text" 
                    placeholder="Search chats..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contactsMock.map((contact) => (
            <div 
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`p-4 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-900/50 transition-colors ${selectedContact.id === contact.id ? 'bg-zinc-900/80 border-l-2 border-l-primary' : ''}`}
            >
              <div className="flex justify-between mb-1">
                <h3 className="font-medium text-zinc-200">{contact.name}</h3>
                <span className="text-xs text-zinc-500">{contact.lastMessageTime}</span>
              </div>
              <p className="text-sm text-zinc-500 truncate mb-2">{contact.lastMessage}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {contact.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">{tag}</span>
                    ))}
                </div>
                {contact.unreadCount ? (
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full h-5 min-w-[1.25rem] flex items-center justify-center">
                        {contact.unreadCount}
                    </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0b0b0d]">
        {/* Chat Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-zinc-900/30 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center text-sm font-bold border border-zinc-600">
                    {selectedContact.name.charAt(0)}
                </div>
                <div>
                    <h3 className="font-medium text-zinc-100">{selectedContact.name}</h3>
                    <p className="text-xs text-zinc-400">Business Account</p>
                </div>
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
                <button className="hover:text-primary transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="hover:text-primary transition-colors"><Video className="w-5 h-5" /></button>
                <div className="w-px h-6 bg-zinc-800" />
                <button className="hover:text-zinc-100 transition-colors"><Search className="w-5 h-5" /></button>
                <button className="hover:text-zinc-100 transition-colors"><MoreVertical className="w-5 h-5" /></button>
            </div>
        </div>

        {/* Messages */}
        <div 
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{ 
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.02) 0%, transparent 50%)'
            }}
        >
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm relative group ${
                        msg.senderId === 'me' 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700'
                    }`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${msg.senderId === 'me' ? 'text-green-900' : 'text-zinc-400'}`}>
                            {msg.timestamp}
                            {msg.senderId === 'me' && (
                                <span className={msg.status === 'read' ? 'text-blue-600' : ''}>
                                    {msg.status === 'read' ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-900/50 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={handleMagicReply}
                    isLoading={isAiLoading}
                >
                    <Sparkles className="w-3 h-3" />
                    Magic Reply
                </Button>
                <span className="text-[10px] text-zinc-500">Powered by Gemini 3 Flash</span>
            </div>
            <div className="flex items-end gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                    <Paperclip className="w-5 h-5" />
                </button>
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 resize-none max-h-32 py-2 placeholder-zinc-600"
                    rows={1}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                />
                <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                    <Mic className="w-5 h-5" />
                </button>
                <Button 
                    variant="primary" 
                    size="icon" 
                    className="h-9 w-9 rounded-lg"
                    onClick={handleSendMessage}
                >
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};