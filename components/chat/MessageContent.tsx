
"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon, Film, User, Copy, QrCode, DollarSign, CheckCircle2, AlertCircle, Sticker, AlertTriangle, ZoomIn, X } from "lucide-react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { useAuthStore } from '@/store/useAuthStore';
import { PollBubble } from './PollBubble'; 

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mediaUrl = message.media_url; 
  let content = message.content || message.body || "";
  const type = (message.message_type || 'text') as string;
  const isMe = message.from_me;

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Copiado!', message: 'Chave Pix copiada.' });
  };

  const getMapEmbedUrl = (lat: number, lng: number) => {
      const bboxDelta = 0.002; 
      const bbox = `${lng - bboxDelta},${lat - bboxDelta},${lng + bboxDelta},${lat + bboxDelta}`;
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  };

  // --- 9. ENQUETE (POLL) ---
  if (type === 'poll') {
      return <PollBubble message={message} isMe={isMe} />;
  }

  // --- 1. IMAGEM (Com Lightbox) ---
  if (type === 'image') {
    const ImageModal = () => {
        if (!mounted) return null;
        return createPortal(
            <div 
                className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-zoom-out"
                onClick={() => setIsZoomed(false)}
            >
                <button 
                    onClick={() => setIsZoomed(false)}
                    className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 group"
                >
                    <X className="w-8 h-8 group-hover:rotate-90 transition-transform" />
                </button>

                <img 
                    src={mediaUrl} 
                    alt="Zoom"
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300 select-none"
                    onClick={(e) => e.stopPropagation()} 
                />
            </div>,
            document.body
        );
    };

    return (
      <div className="space-y-1">
        <div 
            className="relative mt-1 overflow-hidden rounded-lg bg-black/20 border border-white/10 group cursor-zoom-in min-h-[150px] min-w-[200px]"
            onClick={() => !imgError && mediaUrl && setIsZoomed(true)}
        >
            {mediaUrl && !imgError ? (
                <>
                    <img 
                        src={mediaUrl} 
                        alt="Imagem" 
                        className="max-w-[280px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" 
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                        <ZoomIn className="w-8 h-8 text-white/90 drop-shadow-md" />
                    </div>
                </>
            ) : (
                <div className="h-40 w-56 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
                    <ImageIcon className="w-10 h-10 opacity-30 mb-2" />
                    <span className="text-xs text-zinc-400">
                        {mediaUrl ? "Erro ao carregar" : "Mídia indisponível"}
                    </span>
                </div>
            )}
        </div>
        {content && content !== mediaUrl && content !== "Imagem" && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
        {isZoomed && <ImageModal />}
      </div>
    );
  }

  // --- 2. ÁUDIO (Com Avatar) ---
  if (type === 'audio' || type === 'ptt' || type === 'voice') {
    // Determina o avatar a exibir no player
    const avatarUrl = isMe 
        ? user?.avatar_url 
        : message.contact?.profile_pic_url;

    return (
      <div className={cn(
          "flex items-center gap-3 min-w-[260px] mt-1 p-2 rounded-lg border transition-all",
          isMe ? "bg-primary/20 border-primary/30" : "bg-zinc-800/80 border-zinc-700"
      )}>
        <div className="relative shrink-0">
            <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border-2 overflow-hidden",
                isMe ? "border-primary/50 bg-primary/20" : "border-zinc-600 bg-zinc-700"
            )}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <User className={cn("w-6 h-6", isMe ? "text-primary" : "text-zinc-400")} />
                )}
            </div>
            {/* Ícone de Play sobreposto (opcional, ou mantido separado se preferir) */}
            <div className="absolute -bottom-1 -right-1 bg-zinc-900 rounded-full border border-zinc-700 p-0.5">
               {mediaUrl ? <PlayCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
            {mediaUrl ? (
                <audio controls className="h-8 w-full max-w-[200px] opacity-90 scale-95 origin-left" controlsList="nodownload">
                    <source src={mediaUrl} type="audio/ogg" />
                    <source src={mediaUrl} type="audio/mp4" />
                    <source src={mediaUrl} type="audio/mpeg" />
                </audio>
            ) : (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <span className="italic">Áudio não disponível</span>
                </div>
            )}
        </div>
      </div>
    );
  }

  // --- 3. VÍDEO ---
  if (type === 'video') {
    return (
      <div className="space-y-1">
        <div className="relative mt-1 overflow-hidden rounded-lg bg-black border border-zinc-800 max-w-[280px]">
            {mediaUrl ? (
                <video controls className="w-full rounded-lg" preload="metadata" playsInline>
                    <source src={mediaUrl} />
                    Seu navegador não suporta vídeos.
                </video>
            ) : (
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800 flex-col">
                    <Film className="w-8 h-8 opacity-30 mb-2" />
                    <span className="text-xs">Vídeo indisponível</span>
                </div>
            )}
        </div>
        {content && content !== mediaUrl && content !== "Vídeo" && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
      </div>
    );
  }

  // --- 4. DOCUMENTO ---
  if (type === 'document') {
    const fileName = (message as any).fileName || (mediaUrl ? decodeURIComponent(mediaUrl.split('/').pop()?.split('?')[0] || '') : 'Documento');
    return (
      <div 
        onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
        className={cn(
            "flex items-center gap-3 p-3 mt-1 rounded-md border transition-all group max-w-[280px]",
            mediaUrl ? "cursor-pointer" : "cursor-default opacity-70",
            isMe ? "bg-primary/10 border-primary/20 hover:bg-primary/20" : "bg-zinc-800/80 border-zinc-700 hover:bg-zinc-800"
        )}
      >
        <div className={cn("p-2 rounded-full", isMe ? "bg-primary/20" : "bg-zinc-900/50")}>
          <FileText className={cn("w-5 h-5", isMe ? "text-primary" : "text-emerald-500")} />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium truncate max-w-[180px]" title={fileName}>
            {fileName}
          </p>
          <span className="text-[10px] opacity-70 uppercase tracking-wide flex items-center gap-1">
             {mediaUrl ? "Clique para baixar" : "Arquivo removido"}
          </span>
        </div>
        {mediaUrl ? <Download className="w-4 h-4 opacity-50 group-hover:opacity-100" /> : <AlertCircle className="w-3 h-3 text-red-500 opacity-50" />}
      </div>
    );
  }

  // --- 5. STICKER ---
  if (type === 'sticker') {
      return (
          <div className="relative mt-1 overflow-hidden w-32 h-32 flex items-center justify-center p-1">
                {mediaUrl ? (
                    <img 
                        src={mediaUrl} 
                        alt="Sticker" 
                        className="w-full h-full object-contain drop-shadow-lg" 
                        loading="lazy"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if(parent) {
                                parent.innerHTML = '<div class="text-zinc-600 text-[10px] flex flex-col items-center"><svg class="w-6 h-6 mb-1" ...>...</svg>Sticker erro</div>';
                            }
                        }}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-500">
                        <Sticker className="w-8 h-8 opacity-20" />
                        <span className="text-[9px] mt-1 opacity-50">Sticker off</span>
                    </div>
                )}
          </div>
      );
  }

  // --- 6. LOCALIZAÇÃO ---
  if (type === 'location') {
    let lat: number | null = null;
    let long: number | null = null;

    try {
        const parsed = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : {};
        if(parsed.latitude && parsed.longitude) {
            lat = parsed.latitude;
            long = parsed.longitude;
        } else if (typeof content === 'string' && content.includes('Loc:')) {
             const parts = content.replace('Loc:', '').split(',');
             lat = parseFloat(parts[0]);
             long = parseFloat(parts[1]);
        }
    } catch(e) {}

    const mapsUrl = lat && long ? `https://www.google.com/maps?q=${lat},${long}` : '#';

    return (
      <div className="mt-1">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-xl border border-zinc-800/50 group w-[260px] hover:border-primary/50 transition-colors shadow-sm bg-zinc-900">
            <div className="h-36 w-full relative overflow-hidden bg-[#e5e7eb]">
                {lat && long ? (
                    <>
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no" 
                            marginHeight={0} 
                            marginWidth={0} 
                            src={getMapEmbedUrl(lat, long)}
                            className="pointer-events-none opacity-90 scale-110"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4">
                             <MapPin className="w-8 h-8 text-red-600 drop-shadow-md animate-bounce" fill="currentColor" />
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500">
                        <MapPin className="w-8 h-8 opacity-20" />
                    </div>
                )}
            </div>
            
            <div className={cn("p-3 flex items-center gap-3 bg-zinc-800/80 backdrop-blur-sm border-t border-white/5")}>
                <div className="w-10 h-10 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-zinc-100 truncate">Localização Atual</span>
                    <span className="text-xs text-zinc-400 truncate font-mono">
                        {lat ? `${lat.toFixed(6)}, ${long?.toFixed(6)}` : 'Processando...'}
                    </span>
                </div>
            </div>
          </a>
      </div>
    );
  }

  // --- 7. CONTATO ---
  if (type === 'contact') {
      let contactData = { displayName: 'Contato', vcard: '', phone: '' };
      try {
          if(content.startsWith('{')) {
             const parsed = JSON.parse(content);
             contactData.displayName = parsed.displayName || parsed.name || 'Contato';
             contactData.vcard = parsed.vcard || '';
             contactData.phone = parsed.phone || '';
          } else {
             const parts = content.split('|');
             contactData.displayName = parts[0] || 'Contato';
             contactData.vcard = parts[1] || '';
          }
      } catch(e) {}

      if (!contactData.phone && contactData.vcard) {
          const match = contactData.vcard.match(/TEL.*:(.*)/);
          if (match) contactData.phone = match[1];
      }

      return (
          <div className={cn(
              "flex items-center gap-3 p-3 mt-1 rounded-lg border min-w-[240px]",
              isMe ? "bg-primary/10 border-primary/20" : "bg-zinc-800 border-zinc-700"
          )}>
              <div className="w-10 h-10 rounded-full bg-zinc-500/20 flex items-center justify-center text-zinc-300">
                  <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate text-blue-400">{contactData.displayName}</p>
                  <p className="text-xs opacity-70 truncate">{contactData.phone || 'Ver detalhes'}</p>
              </div>
              <button 
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-primary"
                title="Salvar Contato"
              >
                  <span className="text-xs font-bold px-2 py-1 bg-primary/20 rounded border border-primary/30">Salvar</span>
              </button>
          </div>
      );
  }

  // --- 8. PIX ---
  const isExplicitPix = type === 'pix';
  const isTextPix = type === 'text' && typeof content === 'string' && (content.startsWith('Chave Pix:') || content.includes('PIX'));

  if (isExplicitPix || isTextPix) {
      const pixKey = content.replace(/Chave Pix:|PIX:/gi, '').trim();
      
      return (
          <div className="mt-1 min-w-[280px] bg-[#0f172a] rounded-xl overflow-hidden border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative">
              <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-white" />
                  <span className="font-bold text-white text-sm">Pix Copia e Cola</span>
                  <div className="ml-auto bg-white/20 p-1 rounded">
                      <DollarSign className="w-3 h-3 text-white" />
                  </div>
              </div>
              
              <div className="p-4 space-y-3">
                  <div className="space-y-1">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Chave de Pagamento</p>
                      <div className="relative group">
                          <div className="bg-black/30 border border-zinc-700 rounded-lg p-3 font-mono text-sm text-emerald-400 break-all select-all">
                              {pixKey}
                          </div>
                      </div>
                  </div>
                  
                  <button 
                    onClick={() => handleCopy(pixKey)} 
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/50 text-emerald-500 font-bold py-2.5 rounded-lg transition-all active:scale-95 group"
                  >
                      <Copy className="w-4 h-4 group-hover:animate-pulse" />
                      COPIAR CHAVE
                  </button>
              </div>
              
              <div className="bg-emerald-950/30 px-4 py-2 text-[10px] text-zinc-500 flex items-center justify-center gap-1 border-t border-emerald-900/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Pagamento instantâneo e seguro
              </div>
          </div>
      );
  }

  // --- DEFAULT: TEXTO ---
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => 
        part.match(urlRegex) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline hover:text-cyan-300 transition-colors font-medium">{part}</a>
        ) : (
          part
        )
      )}
    </p>
  );
}
