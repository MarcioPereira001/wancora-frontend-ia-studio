
"use client";

import React, { useState } from 'react';
import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon, Film, BarChart2, User, Copy, QrCode, DollarSign, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import { api } from '@/services/api';

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  const { addToast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [votingOptionId, setVotingOptionId] = useState<number | null>(null);

  const mediaUrl = message.media_url; 
  let content = message.content || message.body || "";
  const type = (message.message_type || 'text') as string;
  const isMe = message.from_me;

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Copiado!', message: 'Chave Pix copiada.' });
  };

  // Lógica Real de Votação
  const handleVote = async (optionId: number, pollName: string) => {
      setVotingOptionId(optionId);
      try {
          await api.post('/message/vote', {
              companyId: message.company_id,
              sessionId: message.session_id,
              remoteJid: message.remote_jid,
              pollId: message.id, // O Backend precisa saber qual mensagem é a enquete
              optionId: optionId
          });
          // Optimistic update seria ideal aqui, mas vamos confiar no Realtime do backend
          addToast({ type: 'success', title: 'Voto Enviado', message: `Votou em: Opção ${optionId + 1}` });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao computar voto.' });
      } finally {
          setVotingOptionId(null);
      }
  };

  // --- 1. IMAGEM ---
  if (type === 'image') {
    return (
      <div className="space-y-1">
        <div className="relative mt-1 overflow-hidden rounded-lg bg-black/20 border border-white/10 group cursor-pointer min-h-[150px] min-w-[200px]">
            {mediaUrl && !imgError ? (
                <img 
                src={mediaUrl} 
                alt="Imagem" 
                className="max-w-[280px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" 
                loading="lazy"
                onError={() => setImgError(true)}
                onClick={() => window.open(mediaUrl, '_blank')}
                />
            ) : (
                <div className="h-40 w-56 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
                    {!mediaUrl && !imgError ? (
                        <>
                            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                            <span className="text-xs text-zinc-400">Baixando mídia...</span>
                        </>
                    ) : (
                        <>
                            <ImageIcon className="w-10 h-10 opacity-30 mb-2" />
                            <span className="text-xs text-zinc-400">Imagem expirada</span>
                        </>
                    )}
                </div>
            )}
        </div>
        {content && content !== mediaUrl && content !== "Imagem" && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
      </div>
    );
  }

  // --- 2. ÁUDIO (PTT ou Audio) ---
  if (type === 'audio' || type === 'ptt' || type === 'voice') {
    return (
      <div className={cn(
          "flex items-center gap-3 min-w-[240px] mt-1 p-2 rounded-lg border transition-all",
          isMe ? "bg-primary/20 border-primary/30" : "bg-zinc-800/80 border-zinc-700"
      )}>
        <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            isMe ? "bg-primary text-primary-foreground" : "bg-zinc-700 text-zinc-400"
        )}>
            {mediaUrl ? <PlayCircle className="w-6 h-6" /> : <Loader2 className="w-5 h-5 animate-spin" />}
        </div>
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
            {mediaUrl ? (
                <audio controls className="h-8 w-full max-w-[200px] opacity-90 scale-[0.85] origin-left filter hue-rotate-15">
                    <source src={mediaUrl} />
                </audio>
            ) : (
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <span className="italic">Processando áudio...</span>
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
                <video controls className="w-full rounded-lg" preload="metadata">
                    <source src={mediaUrl} />
                    Seu navegador não suporta vídeos.
                </video>
            ) : (
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800 flex-col">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    <span className="text-xs">Baixando vídeo...</span>
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
            "flex items-center gap-3 p-3 mt-1 rounded-md border cursor-pointer transition-all group max-w-[280px]",
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
             {mediaUrl ? "Clique para baixar" : "Processando..."}
          </span>
        </div>
        {mediaUrl ? <Download className="w-4 h-4 opacity-50 group-hover:opacity-100" /> : <Loader2 className="w-3 h-3 animate-spin opacity-50" />}
      </div>
    );
  }

  // --- 5. LOCALIZAÇÃO ---
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
    // Static Map Fallback (Sem API Key)
    // Usamos um mapa estático genérico e sobrepomos o pin com CSS
    const staticMapBg = "https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg";

    return (
      <div className="mt-1">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-lg border border-white/10 group w-[260px] hover:border-primary/50 transition-colors shadow-lg">
            <div className="bg-[#e5e7eb] h-36 w-full flex items-center justify-center relative overflow-hidden">
                {/* Simulated Map Layer */}
                <div 
                    className="absolute inset-0 opacity-40 bg-cover bg-center grayscale-[30%]"
                    style={{ backgroundImage: `url('${staticMapBg}')` }}
                ></div>
                
                {/* Grid Lines Pattern (Simulate Roads) */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* PIN */}
                <div className="relative z-10 flex flex-col items-center -mt-4 animate-bounce">
                    <div className="bg-red-500 p-2 rounded-full shadow-xl border-2 border-white">
                        <MapPin className="w-6 h-6 text-white" fill="currentColor" />
                    </div>
                    <div className="w-2 h-1 bg-black/20 rounded-full blur-[2px] mt-1"></div>
                </div>

                {/* Footer Gradient */}
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            
            <div className={cn("p-3 flex items-center justify-between gap-2 border-t border-white/5", isMe ? "bg-[#005c4b]/50" : "bg-zinc-900")}>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate">Localização Atual</span>
                    <span className="text-[10px] text-zinc-400 truncate font-mono">
                        {lat ? `${lat.toFixed(5)}, ${long?.toFixed(5)}` : 'Carregando coordenadas...'}
                    </span>
                </div>
                <div className="bg-white/10 p-1.5 rounded-full">
                    <MapPin className="w-4 h-4 text-white" />
                </div>
            </div>
          </a>
      </div>
    );
  }

  // --- 6. CONTATO ---
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

  // --- 7. PIX ---
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

  // --- 8. ENQUETE REAL (INTERATIVA) ---
  if (type === 'poll') {
    let pollData = { name: 'Enquete', options: [], selectableOptionsCount: 1 };
    try {
        pollData = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : { name: content, options: [] };
    } catch (e) {
        pollData.name = content;
    }

    // Calcula estatísticas de votos baseado em message.poll_votes
    const votes = message.poll_votes || [];
    const totalVotes = votes.length;
    const votesPerOption = new Map<number, number>();
    
    votes.forEach(v => {
        const current = votesPerOption.get(v.optionId) || 0;
        votesPerOption.set(v.optionId, current + 1);
    });

    return (
        <div className={cn(
            "rounded-xl p-4 min-w-[280px] space-y-4 mt-1 border shadow-sm relative overflow-hidden",
            isMe ? "bg-zinc-900 border-zinc-700" : "bg-zinc-900 border-zinc-700"
        )}>
            {/* Header */}
            <div className="flex items-start gap-3 relative z-10">
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                    <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-white leading-tight">{pollData.name || 'Enquete'}</h4>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        {pollData.selectableOptionsCount > 1 ? 'Múltipla escolha' : 'Escolha uma opção'} • {totalVotes} votos
                    </span>
                </div>
            </div>

            {/* Options com Barra de Progresso Real */}
            <div className="space-y-2 relative z-10">
                {pollData.options?.map((opt: string, idx: number) => {
                    const voteCount = votesPerOption.get(idx) || 0;
                    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const isVoting = votingOptionId === idx;

                    return (
                        <button 
                            key={idx} 
                            onClick={() => handleVote(idx, pollData.name)}
                            disabled={isVoting}
                            className={cn(
                                "w-full relative flex items-center justify-between p-3 rounded-lg border text-sm transition-all overflow-hidden",
                                "bg-black/20 border-zinc-800 text-zinc-300 hover:border-zinc-600 active:scale-[0.99]"
                            )}
                        >
                            {/* Progress Bar Background */}
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-yellow-500/10 transition-all duration-700 ease-out" 
                                style={{ width: `${percentage}%` }}
                            />

                            <div className="flex items-center gap-3 relative z-10">
                                <div className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                                    "border-zinc-600 group-hover:border-zinc-400"
                                )}>
                                    {isVoting && <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />}
                                </div>
                                <span className="font-medium truncate mr-2 text-xs">{opt}</span>
                            </div>

                            <div className="relative z-10 flex items-center gap-2">
                                {/* Avatares dos votantes (Simulado - pegando 3 primeiros) */}
                                {votes.filter(v => v.optionId === idx).slice(0, 3).map((v, i) => (
                                    <div key={i} className="w-4 h-4 rounded-full bg-zinc-700 border border-zinc-800 -ml-2 first:ml-0" title={v.voterJid} />
                                ))}
                                <span className="text-[10px] font-bold text-zinc-500">{voteCount}</span>
                            </div>
                        </button>
                    )
                })}
            </div>
            
            {/* Footer */}
            <div className="text-center pt-2 border-t border-white/5">
                <span className="text-[10px] text-zinc-500 font-medium">Toque para votar</span>
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
