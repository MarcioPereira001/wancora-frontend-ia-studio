
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send, Trash2, Image as IconImage, FileText, MapPin, User, BarChart2, Ban, Smile, CheckSquare, Loader2, Sticker, ShoppingBag, LayoutTemplate, Bold, Italic, Strikethrough, Code, List, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { Message } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { SendMessageSchema } from '@/lib/schemas'; 
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { CatalogModal } from './CatalogModal';
import { cn } from '@/lib/utils';

const REVOKE_WINDOW_MS = 24 * 60 * 60 * 1000; 

export function ChatInputArea() {
  const { user } = useAuthStore();
  const { 
      activeContact, selectedInstance, addMessage, 
      isMsgSelectionMode, selectedMsgIds, messages, clearSelection 
  } = useChatStore();
  const { addToast } = useToast();

  const [input, setInput] = useState("");
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null); // REF PARA LIMPEZA DE MEMÓRIA
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  
  // Textarea Ref para manipulação de cursor/seleção
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeModal, setActiveModal] = useState<'poll'|'contact'|'location'|'delete_confirm'|'catalog'|'card'|null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Modal States
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Sim", "Não"]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  
  // Card States
  const [cardTitle, setCardTitle] = useState("");
  const [cardDesc, setCardDesc] = useState("");
  const [cardLink, setCardLink] = useState("");
  const [cardThumb, setCardThumb] = useState("");

  // 🛡️ MEMORY LEAK FIX: Limpeza ao desmontar ou trocar chat
  useEffect(() => {
      setMediaMenuOpen(false);
      setEmojiPickerOpen(false);
      setActiveModal(null);
      
      // Se mudar de contato enquanto grava, cancela e limpa
      if (isRecording) {
          stopRecording(true);
      }
      
      return () => {
          // Garante que o stream seja morto ao desmontar o componente
          if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach(track => track.stop());
              audioStreamRef.current = null;
          }
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, [activeContact?.id]);

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (mediaMenuRef.current && !mediaMenuRef.current.contains(event.target as Node)) {
              setMediaMenuOpen(false);
          }
          if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
              setEmojiPickerOpen(false);
          }
      }
      if (mediaMenuOpen || emojiPickerOpen) {
          document.addEventListener("mousedown", handleClickOutside);
      }
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [mediaMenuOpen, emojiPickerOpen]);

  const onEmojiClick = (emojiData: any) => {
      const textarea = textareaRef.current;
      if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = input;
          const before = text.substring(0, start);
          const after = text.substring(end, text.length);
          
          setInput(before + emojiData.emoji + after);
          
          // Reposition cursor
          setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + emojiData.emoji.length;
              textarea.focus();
          }, 0);
      } else {
          setInput(prev => prev + emojiData.emoji);
      }
  };

  // --- FORMATTING LOGIC ---
  const applyFormat = (formatType: 'bold' | 'italic' | 'strike' | 'mono' | 'list' | 'quote') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = input.substring(start, end);
      const before = input.substring(0, start);
      const after = input.substring(end);

      let newText = '';
      let newCursorPos = end;

      switch (formatType) {
          case 'bold':
              newText = `${before}*${selectedText}*${after}`;
              newCursorPos = end + 2; // +2 for **
              if (selectedText.length === 0) newCursorPos = start + 1; // Cursor inside *|*
              break;
          case 'italic':
              newText = `${before}_${selectedText}_${after}`;
              newCursorPos = end + 2;
              if (selectedText.length === 0) newCursorPos = start + 1;
              break;
          case 'strike':
              newText = `${before}~${selectedText}~${after}`;
              newCursorPos = end + 2;
              if (selectedText.length === 0) newCursorPos = start + 1;
              break;
          case 'mono':
              newText = `${before}\`\`\`${selectedText}\`\`\`${after}`;
              newCursorPos = end + 6;
              if (selectedText.length === 0) newCursorPos = start + 3;
              break;
          case 'list':
              const listPrefix = '\n- ';
              // Se tiver seleção multilinha, aplica em cada linha
              if (selectedText.includes('\n')) {
                  const listContent = selectedText.split('\n').map(line => `- ${line}`).join('\n');
                  newText = `${before}${listContent}${after}`;
                  newCursorPos = start + listContent.length;
              } else {
                  newText = `${before}${listPrefix}${selectedText}${after}`;
                  newCursorPos = end + listPrefix.length;
              }
              break;
          case 'quote':
              const quotePrefix = '> ';
              newText = `${before}${quotePrefix}${selectedText}${after}`;
              newCursorPos = end + quotePrefix.length;
              break;
      }

      setInput(newText);
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
  };

  const dispatchMessage = async (payload: any) => {
      if(!activeContact || !user?.company_id || !selectedInstance) return;
      
      const apiPayload = {
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
          product: payload.type === 'product' ? payload.content : undefined,
          card: payload.type === 'card' ? payload.content : undefined,
          mimetype: payload.mimetype,
          fileName: payload.fileName,
          ptt: payload.ptt
      };

      const validation = SendMessageSchema.safeParse(apiPayload);
      if (!validation.success) {
          console.log(validation.error);
          addToast({ type: 'error', title: 'Erro', message: 'Mensagem inválida. Verifique os campos.' });
          return;
      }

      const tempId = `temp-${Date.now()}`;
      let contentDisplay = payload.text;
      
      if (payload.type === 'poll') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'location') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'contact') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'product') contentDisplay = payload.content.title || 'Produto';
      if (payload.type === 'card') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'sticker') contentDisplay = 'Figurinha';
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

      addMessage(tempMsg);

      try {
          await api.post('/message/send', validation.data);
      } catch (error) { 
          addToast({ type: 'error', title: 'Falha', message: 'Erro ao enviar mensagem.' });
      }
  };

  const handleSendText = () => { if(input.trim()) { dispatchMessage({ type: 'text', text: input }); setInput(""); setEmojiPickerOpen(false); }};

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, forceSticker = false) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id) return;
      
      setMediaMenuOpen(false); 
      addToast({ type: 'info', title: 'Upload', message: 'Processando...' });
      
      try {
          const { publicUrl, fileName } = await uploadChatMedia(file, user.company_id);
          let type = 'document';
          let ptt = false;
          
          if (forceSticker) type = 'sticker';
          else if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';
          else if (file.type.startsWith('audio/')) { type = 'audio'; ptt = false; }

          await dispatchMessage({ type, url: publicUrl, caption: input, fileName: fileName, mimetype: file.type, ptt: ptt }); 
          setInput("");
      } catch (e: any) { addToast({ type: 'error', title: 'Erro', message: e.message }); }
      finally { 
          if (fileInputRef.current) fileInputRef.current.value = ''; 
          if (audioInputRef.current) audioInputRef.current.value = '';
          if (stickerInputRef.current) stickerInputRef.current.value = '';
      }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Armazena referência para limpeza posterior
          audioStreamRef.current = stream;

          let mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';

          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          
          mediaRecorder.onstop = async () => {
              // Se foi cancelado, não processa
              if (!mediaRecorderRef.current) return;

              const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
              const audioFile = new File([audioBlob], `ptt_${Date.now()}.${mimeType === 'audio/mp4' ? 'mp4' : 'webm'}`, { type: mimeType });
              
              if (audioFile.size > 0 && user?.company_id) {
                  try {
                      const { publicUrl } = await uploadChatMedia(audioFile, user.company_id);
                      await dispatchMessage({ type: 'audio', url: publicUrl, mimetype: mimeType, ptt: true });
                  } catch (e) {}
              }
              
              // Limpeza crítica de tracks
              if (audioStreamRef.current) {
                  audioStreamRef.current.getTracks().forEach(track => track.stop());
                  audioStreamRef.current = null;
              }
          };
          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) { addToast({ type: 'error', title: 'Erro', message: 'Microfone não acessível.' }); }
  };

  const stopRecording = (cancel = false) => {
      if (mediaRecorderRef.current && isRecording) {
          if (cancel) {
              // Remove listener para não disparar envio
              mediaRecorderRef.current.onstop = null;
              // Limpa tracks imediatamente
              if (audioStreamRef.current) {
                  audioStreamRef.current.getTracks().forEach(track => track.stop());
                  audioStreamRef.current = null;
              }
          }
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null; // Zera referência
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
  };

  const canDeleteForEveryone = () => {
      if (selectedMsgIds.size === 0) return false;
      const selected = messages.filter(m => selectedMsgIds.has(m.id));
      return selected.every(m => {
          if (!m.from_me) return false;
          const msgTime = new Date(m.created_at).getTime();
          return (Date.now() - msgTime) < REVOKE_WINDOW_MS;
      });
  };

  const handleBulkDelete = async (everyone: boolean) => {
      setIsDeleting(true);
      const ids = Array.from(selectedMsgIds);
      let successCount = 0;
      for (const msgId of ids) {
          const msg = messages.find(m => m.id === msgId);
          if (msg) {
              try {
                  await api.post('/message/delete', {
                      sessionId: msg.session_id,
                      companyId: msg.company_id,
                      remoteJid: msg.remote_jid,
                      msgId: msg.id,
                      everyone
                  });
                  successCount++;
              } catch (e) {}
          }
      }
      addToast({ type: 'success', title: 'Concluído', message: `${successCount} mensagens apagadas.` });
      setIsDeleting(false);
      setActiveModal(null);
      clearSelection();
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handlers
  const handleCreatePoll = () => { if(!pollQuestion.trim()) return; const valid = pollOptions.filter(o => o.trim().length > 0); if(valid.length < 2) return; dispatchMessage({ type: 'poll', content: { name: pollQuestion, options: valid, selectableOptionsCount: 1 } }); setPollQuestion(""); setPollOptions(["Sim", "Não"]); setActiveModal(null); };
  const handleSendContact = () => { if(!contactName.trim() || !contactPhone.trim()) return; const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL:${contactPhone}\nEND:VCARD`; dispatchMessage({ type: 'contact', content: { displayName: contactName, vcard, phone: contactPhone } }); setContactName(""); setContactPhone(""); setActiveModal(null); };
  const getCurrentLocation = () => { if (!navigator.geolocation) return; setLocLoading(true); navigator.geolocation.getCurrentPosition((pos) => { setLocLat(pos.coords.latitude); setLocLng(pos.coords.longitude); setLocLoading(false); }, () => setLocLoading(false), { enableHighAccuracy: true }); };
  const handleSendLocation = () => { if (locLat && locLng) { dispatchMessage({ type: 'location', content: { latitude: Number(locLat), longitude: Number(locLng) } }); setActiveModal(null); setLocLat(null); setLocLng(null); } };
  
  const handleSendProduct = (product: any) => {
      dispatchMessage({ 
          type: 'product', 
          content: {
              productId: product.product_id,
              title: product.name,
              description: product.description,
              currencyCode: product.currency,
              priceAmount1000: (product.price || 0) * 1000,
              productImageCount: product.image_url ? 1 : 0
          },
          url: product.image_url 
      });
      setActiveModal(null);
  };

  const handleSendCard = () => {
      if(!cardTitle.trim() || !cardLink.trim()) {
          addToast({ type: 'warning', title: 'Campos Obrigatórios', message: 'Título e Link são necessários.' });
          return;
      }
      dispatchMessage({
          type: 'card',
          content: {
              title: cardTitle,
              description: cardDesc,
              link: cardLink,
              thumbnailUrl: cardThumb
          }
      });
      setCardTitle(""); setCardDesc(""); setCardLink(""); setCardThumb("");
      setActiveModal(null);
  };

  if (isMsgSelectionMode) {
      const canEveryone = canDeleteForEveryone();
      return (
          <>
          <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-between animate-in slide-in-from-bottom-10 shrink-0 z-50">
              <span className="text-sm text-white font-medium flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  {selectedMsgIds.size} selecionadas
              </span>
              <div className="flex gap-3">
                  <Button variant="ghost" onClick={clearSelection}>Cancelar</Button>
                  <Button variant="destructive" disabled={selectedMsgIds.size === 0} onClick={() => setActiveModal('delete_confirm')} className="bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-400 border border-red-500/20">
                      <Trash2 className="w-4 h-4 mr-2" /> Apagar
                  </Button>
              </div>
          </div>
          <Modal isOpen={activeModal === 'delete_confirm'} onClose={() => setActiveModal(null)} title={`Apagar ${selectedMsgIds.size} mensagens?`} maxWidth="sm">
              <div className="space-y-4">
                  <p className="text-sm text-zinc-400">Escolha como deseja apagar as mensagens selecionadas:</p>
                  <div className="flex flex-col gap-2">
                      {canEveryone && (
                          <Button variant="destructive" onClick={() => handleBulkDelete(true)} disabled={isDeleting} className="w-full justify-start bg-zinc-800 hover:bg-red-900/30 text-red-400 border-zinc-700">
                              <Trash2 className="w-4 h-4 mr-2" /> Apagar para todos
                          </Button>
                      )}
                      <Button variant="outline" onClick={() => handleBulkDelete(false)} disabled={isDeleting} className="w-full justify-start border-zinc-700 hover:bg-zinc-800">
                          <Ban className="w-4 h-4 mr-2" /> Apagar para mim
                      </Button>
                  </div>
              </div>
          </Modal>
          </>
      );
  }

  return (
    <>
    <div className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur relative shrink-0 z-[50]">
        <div className="flex flex-col gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner relative">
            
            {/* Formatting Toolbar */}
            {input.length > 0 && !isRecording && (
                <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 mb-1 px-1">
                     <button onClick={() => applyFormat('bold')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Negrito (*texto*)"><Bold className="w-3.5 h-3.5" /></button>
                     <button onClick={() => applyFormat('italic')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Itálico (_texto_)"><Italic className="w-3.5 h-3.5" /></button>
                     <button onClick={() => applyFormat('strike')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Tachado (~texto~)"><Strikethrough className="w-3.5 h-3.5" /></button>
                     <button onClick={() => applyFormat('mono')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Monoespaçado (```texto```)"><Code className="w-3.5 h-3.5" /></button>
                     <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                     <button onClick={() => applyFormat('list')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Lista de Tópicos"><List className="w-3.5 h-3.5" /></button>
                     <button onClick={() => applyFormat('quote')} className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Citação"><Quote className="w-3.5 h-3.5" /></button>
                </div>
            )}

            <div className="flex items-end gap-2 w-full">
                <div className="relative" ref={emojiRef}>
                    <Button variant="ghost" size="icon" className={`h-9 w-9 ${emojiPickerOpen ? 'text-yellow-400' : 'text-zinc-400'} hover:text-yellow-400`} onClick={() => { setEmojiPickerOpen(!emojiPickerOpen); setMediaMenuOpen(false); }}>
                        <Smile className="h-5 w-5" />
                    </Button>
                    {emojiPickerOpen && (
                        <div className="absolute bottom-14 left-0 z-[100] animate-in zoom-in-95 shadow-2xl">
                            <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={320} height={400} lazyLoadEmojis={true} previewConfig={{ showPreview: false }} />
                        </div>
                    )}
                </div>

                <div className="relative" ref={mediaMenuRef}>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100" onClick={() => { setMediaMenuOpen(!mediaMenuOpen); setEmojiPickerOpen(false); }}><Paperclip className="h-5 w-5" /></Button>
                    {mediaMenuOpen && (
                        <div className="absolute bottom-14 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 w-64 z-[100] grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 ring-1 ring-white/10">
                            <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <IconImage className="w-5 h-5 text-purple-400" /> Galeria
                                <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e)} />
                            </label>
                            <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <Sticker className="w-5 h-5 text-emerald-400" /> Figurinha
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} ref={stickerInputRef} />
                            </label>
                            <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <FileText className="w-5 h-5 text-blue-400" /> Documento
                                <input type="file" className="hidden" accept="*" onChange={(e) => handleFileUpload(e)} ref={fileInputRef} />
                            </label>
                            <button onClick={() => { setMediaMenuOpen(false); setActiveModal('catalog'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <ShoppingBag className="w-5 h-5 text-pink-400" /> Produto
                            </button>
                            <button onClick={() => { setMediaMenuOpen(false); setActiveModal('card'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <LayoutTemplate className="w-5 h-5 text-orange-400" /> Card (Link)
                            </button>
                            <button onClick={() => { setMediaMenuOpen(false); setActiveModal('location'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <MapPin className="w-5 h-5 text-red-400" /> Localização
                            </button>
                            <button onClick={() => { setMediaMenuOpen(false); setActiveModal('contact'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <User className="w-5 h-5 text-blue-400" /> Contato
                            </button>
                            <button onClick={() => { setMediaMenuOpen(false); setActiveModal('poll'); }} className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                                <BarChart2 className="w-5 h-5 text-yellow-400" /> Enquete
                            </button>
                        </div>
                    )}
                </div>

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
                        <textarea 
                            ref={textareaRef}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-2 max-h-32 custom-scrollbar" 
                            placeholder="Digite..." 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} 
                            rows={1} 
                        />
                        
                        {input.trim() ? (
                            <Button size="icon" className="h-9 w-9 transition-transform" onClick={handleSendText}><Send className="h-4 w-4" /></Button>
                        ) : (
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-white" onClick={startRecording}><Mic className="h-5 w-5" /></Button>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>

    {/* MODAIS */}
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

      <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title="Enviar Contato">
          <div className="space-y-4">
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nome do Contato" />
              <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Telefone" />
              <Button onClick={handleSendContact} className="w-full">Enviar Cartão de Contato</Button>
          </div>
      </Modal>

      <Modal isOpen={activeModal === 'location'} onClose={() => { setActiveModal(null); setLocLat(null); }} title="Compartilhar Localização">
          <div className="text-center p-4">
              {locLoading ? <Loader2 className="w-10 h-10 animate-spin mx-auto" /> : 
              locLat ? <Button onClick={handleSendLocation} className="w-full">Enviar Localização</Button> :
              <Button onClick={getCurrentLocation} className="w-full">Obter Localização</Button>}
          </div>
      </Modal>

      <Modal isOpen={activeModal === 'card'} onClose={() => setActiveModal(null)} title="Novo Card (Rich Link)">
          <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Título</label>
                <Input value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="Ex: Promoção Relâmpago" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Descrição (Opcional)</label>
                <Input value={cardDesc} onChange={e => setCardDesc(e.target.value)} placeholder="Clique para saber mais..." className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Link de Destino</label>
                <Input value={cardLink} onChange={e => setCardLink(e.target.value)} placeholder="https://seu-site.com" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase">Imagem de Capa (URL)</label>
                <Input value={cardThumb} onChange={e => setCardThumb(e.target.value)} placeholder="https://.../imagem.jpg" className="mt-1" />
              </div>
              <Button onClick={handleSendCard} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Enviar Card</Button>
          </div>
      </Modal>

      <CatalogModal 
          isOpen={activeModal === 'catalog'} 
          onClose={() => setActiveModal(null)} 
          onSendProduct={handleSendProduct}
      />
    </>
  );
}
