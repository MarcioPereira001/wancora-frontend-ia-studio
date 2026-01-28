'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Mic, Send, Trash2, Image as IconImage, FileText, Music, MapPin, User, BarChart2, DollarSign, CheckSquare, Loader2, Crosshair, Sticker, Smile, Navigation } from 'lucide-react';
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

export function ChatInputArea() {
  const { user } = useAuthStore();
  const { 
      activeContact, selectedInstance, addMessage, 
      isMsgSelectionMode, selectedMsgIds, toggleMsgSelectionMode, clearSelection 
  } = useChatStore();
  const { addToast } = useToast();

  const [input, setInput] = useState("");
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  
  // Gravador Robusto
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recorderMimeType, setRecorderMimeType] = useState<string>('');
  
  // Ref para controlar cancelamento (Evita envio no onstop)
  const isCancelledRef = useRef(false);

  // Refs de Input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  // Modais de Anexo
  const [activeModal, setActiveModal] = useState<'poll'|'pix'|'contact'|'location'|null>(null);
  
  // -- ESTADOS DOS MODAIS --
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["Sim", "Não"]);
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("cpf");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  // 0. RESET DE ESTADO AO TROCAR DE CONVERSA
  useEffect(() => {
      setMediaMenuOpen(false);
      setEmojiPickerOpen(false);
      setActiveModal(null);
      // Reseta gravação se trocar de chat
      if (isRecording) stopRecording(true);
  }, [activeContact?.id]);

  // Fecha menus ao clicar fora
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

  // Auto-Start Location quando abre o modal
  useEffect(() => {
      if (activeModal === 'location' && !locLat) {
          getCurrentLocation();
      }
  }, [activeModal]);

  const onEmojiClick = (emojiData: any) => {
      setInput(prev => prev + emojiData.emoji);
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
          mimetype: payload.mimetype,
          fileName: payload.fileName,
          ptt: payload.ptt
      };

      const validation = SendMessageSchema.safeParse(apiPayload);
      if (!validation.success) {
          console.error("Payload Inválido:", validation.error.format());
          addToast({ type: 'error', title: 'Erro de Validação', message: 'Dados da mensagem inválidos ou incompletos.' });
          return;
      }

      const tempId = `temp-${Date.now()}`;
      let contentDisplay = payload.text;
      
      // Ajuste visual otimista
      if (payload.type === 'pix') contentDisplay = `Chave Pix: ${payload.text}`;
      if (payload.type === 'poll') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'location') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'contact') contentDisplay = JSON.stringify(payload.content);
      if (payload.type === 'sticker') contentDisplay = '[Figurinha]';
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
          else if (file.type === 'image/webp') type = 'sticker'; 

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
          
          // Detecta melhor formato (Chrome usa WebM/Opus, Safari MP4)
          let mimeType = 'audio/webm;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = 'audio/mp4'; // Fallback iOS
              if (!MediaRecorder.isTypeSupported(mimeType)) {
                  mimeType = ''; // Default browser
              }
          }
          setRecorderMimeType(mimeType);

          const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          
          isCancelledRef.current = false; // Reset cancel flag

          mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          
          mediaRecorder.onstop = async () => {
              // VERIFICAÇÃO CRÍTICA DE CANCELAMENTO
              if (isCancelledRef.current) {
                  // console.log("Gravação cancelada. Descartes.");
                  stream.getTracks().forEach(track => track.stop());
                  return;
              }

              const mime = recorderMimeType || 'audio/webm';
              const audioBlob = new Blob(audioChunksRef.current, { type: mime });
              
              // Define extensão correta
              const ext = mime.includes('mp4') ? 'mp4' : 'webm';
              const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, { type: mime });
              
              if (audioFile.size > 0 && user?.company_id) {
                  try {
                      const { publicUrl } = await uploadChatMedia(audioFile, user.company_id);
                      // Envia mimetype real para backend processar
                      await dispatchMessage({ 
                          type: 'audio', 
                          url: publicUrl, 
                          mimetype: mime, 
                          ptt: true 
                      });
                  } catch (e) {}
              }
              stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (err) { addToast({ type: 'error', title: 'Microfone', message: 'Permissão negada ou não suportado.' }); }
  };

  const stopRecording = (cancel = false) => {
      // Define a flag ANTES de parar
      isCancelledRef.current = cancel;

      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop(); // Isso dispara o onstop
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

  // Handlers de Modais
  const handleCreatePoll = () => { if(!pollQuestion.trim()) return; const valid = pollOptions.filter(o => o.trim().length > 0); if(valid.length < 2) return; dispatchMessage({ type: 'poll', content: { name: pollQuestion, options: valid, selectableOptionsCount: 1 } }); setPollQuestion(""); setPollOptions(["Sim", "Não"]); setActiveModal(null); };
  
  const handleSendPix = () => { 
      if(!pixKey.trim()) return; 
      dispatchMessage({ type: 'pix', text: pixKey }); 
      setPixKey(""); 
      setActiveModal(null); 
  };
  
  const handleSendContact = () => { if(!contactName.trim() || !contactPhone.trim()) return; const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL:${contactPhone}\nEND:VCARD`; dispatchMessage({ type: 'contact', content: { displayName: contactName, vcard, phone: contactPhone } }); setContactName(""); setContactPhone(""); setActiveModal(null); };
  
  const getCurrentLocation = () => { 
      if (!navigator.geolocation) {
          addToast({ type: 'error', title: 'Erro', message: 'Geolocalização não suportada.' });
          return;
      }
      setLocLoading(true); 
      navigator.geolocation.getCurrentPosition(
          (pos) => { 
              setLocLat(pos.coords.latitude); 
              setLocLng(pos.coords.longitude); 
              setLocLoading(false); 
          }, 
          (err) => { 
              setLocLoading(false); 
              addToast({ type: 'error', title: 'Erro GPS', message: 'Não foi possível obter sua localização. Verifique as permissões.' });
          }, 
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      ); 
  };
  
  const handleSendLocation = () => { 
      if (locLat && locLng) { 
          dispatchMessage({ 
              type: 'location', 
              content: { latitude: Number(locLat), longitude: Number(locLng) } 
          }); 
          setActiveModal(null); 
          setLocLat(null); 
          setLocLng(null); 
      } 
  };

  // Helper para gerar URL do OpenStreetMap Embed (Mapinha)
  const getMapEmbedUrl = (lat: number, lng: number) => {
      const bboxDelta = 0.005; // Zoom aproximado
      const bbox = `${lng - bboxDelta},${lat - bboxDelta},${lng + bboxDelta},${lat + bboxDelta}`;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  };

  if (isMsgSelectionMode) {
      return (
          <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex items-center justify-center animate-in slide-in-from-bottom-10 shrink-0">
              <span className="text-sm text-white font-medium pl-2">{selectedMsgIds.size} selecionadas</span>
              <div className="flex gap-3 ml-auto">
                  <Button variant="ghost" onClick={clearSelection}>Cancelar</Button>
                  <Button variant="destructive" disabled={selectedMsgIds.size === 0}><Trash2 className="w-4 h-4 mr-2" /> Apagar</Button>
              </div>
          </div>
      );
  }

  return (
    <>
    <div className="p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur relative shrink-0 z-[50]">
        <div className="flex items-end gap-2 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner relative">
            
            {/* Botão de Emojis */}
            <div className="relative" ref={emojiRef}>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 ${emojiPickerOpen ? 'text-yellow-400' : 'text-zinc-400'} hover:text-yellow-400 transition-colors`} 
                    onClick={() => { setEmojiPickerOpen(!emojiPickerOpen); setMediaMenuOpen(false); }}
                >
                    <Smile className="h-5 w-5" />
                </Button>
                
                {emojiPickerOpen && (
                    <div className="absolute bottom-14 left-0 z-[100] animate-in zoom-in-95 origin-bottom-left shadow-2xl drop-shadow-2xl">
                        <EmojiPicker 
                            onEmojiClick={onEmojiClick}
                            theme={Theme.DARK}
                            searchDisabled={false}
                            width={320}
                            height={400}
                            lazyLoadEmojis={true}
                            previewConfig={{ showPreview: false }}
                        />
                    </div>
                )}
            </div>

            {/* Anexo Menu */}
            <div className="relative" ref={mediaMenuRef}>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-100" onClick={() => { setMediaMenuOpen(!mediaMenuOpen); setEmojiPickerOpen(false); }}><Paperclip className="h-5 w-5" /></Button>
                {mediaMenuOpen && (
                    <div className="absolute bottom-14 left-0 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 w-64 z-[100] grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 ring-1 ring-white/10">
                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                            <IconImage className="w-5 h-5 text-purple-400" /> Galeria
                            <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                        </label>
                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                            <FileText className="w-5 h-5 text-blue-400" /> Documento
                            <input type="file" className="hidden" accept="*" onChange={handleFileUpload} ref={fileInputRef} />
                        </label>
                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                            <Music className="w-5 h-5 text-pink-400" /> Áudio
                            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} ref={audioInputRef} />
                        </label>
                        <label className="flex flex-col items-center gap-1 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs text-zinc-400 hover:text-white transition-colors">
                            <Sticker className="w-5 h-5 text-orange-400" /> Figurinha
                            <input type="file" className="hidden" accept="image/webp,image/png,image/jpeg" onChange={handleFileUpload} ref={stickerInputRef} />
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
                    <textarea className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none py-2 max-h-32 custom-scrollbar" placeholder="Digite..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }}} rows={1} />
                    
                    {input.trim() ? (
                        <Button size="icon" className="h-9 w-9 transition-transform" onClick={handleSendText}><Send className="h-4 w-4" /></Button>
                    ) : (
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-white" onClick={startRecording}><Mic className="h-5 w-5" /></Button>
                    )}
                </>
            )}
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

      <Modal isOpen={activeModal === 'location'} onClose={() => { setActiveModal(null); setLocLat(null); }} title="Compartilhar Localização">
          <div className="space-y-4 py-2">
              <div className="relative w-full h-64 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 group shadow-inner">
                  {locLat && locLng ? (
                      <>
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no" 
                            marginHeight={0} 
                            marginWidth={0} 
                            src={getMapEmbedUrl(locLat, locLng)}
                            className="opacity-90 grayscale-[20%] hover:grayscale-0 transition-all duration-700"
                        />
                        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"></div>
                        <div className="absolute bottom-2 left-2 right-2 bg-zinc-900/90 text-white text-xs p-3 rounded-lg shadow-xl backdrop-blur border border-zinc-700 flex justify-between items-center animate-in slide-in-from-bottom-2">
                            <div className="flex flex-col">
                                <span className="font-bold text-zinc-300 text-[10px] uppercase">Coordenadas</span>
                                <span className="font-mono text-primary">{locLat.toFixed(5)}, {locLng.toFixed(5)}</span>
                            </div>
                            <span className="text-[10px] font-bold text-green-500 flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded">
                                <Navigation className="w-3 h-3" /> GPS Preciso
                            </span>
                        </div>
                      </>
                  ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-4 bg-zinc-900">
                          {locLoading ? (
                              <>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse"></div>
                                    <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
                                </div>
                                <p className="text-xs font-mono text-primary animate-pulse">Buscando satélites...</p>
                              </>
                          ) : (
                              <>
                                <MapPin className="w-12 h-12 opacity-20" />
                                <p className="text-sm">Habilite a localização para continuar</p>
                              </>
                          )}
                      </div>
                  )}
              </div>
              
              {!locLat ? (
                  <Button onClick={getCurrentLocation} className="w-full h-12 text-sm bg-blue-600 hover:bg-blue-500" disabled={locLoading}>
                      <Crosshair className="w-4 h-4 mr-2" /> {locLoading ? "Aguarde..." : "Obter Localização Atual"}
                  </Button>
              ) : (
                  <div className="flex gap-3">
                      <Button variant="outline" onClick={() => { setLocLat(null); setLocLng(null); getCurrentLocation(); }} className="flex-1 border-zinc-700">
                          Atualizar
                      </Button>
                      <Button onClick={handleSendLocation} className="flex-[2] bg-green-600 hover:bg-green-500 font-bold">
                          <Send className="w-4 h-4 mr-2" /> Enviar Localização Atual
                      </Button>
                  </div>
              )}
          </div>
      </Modal>
    </>
  );
}