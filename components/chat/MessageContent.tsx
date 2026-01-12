"use client";

import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon, Film, BarChart2 } from "lucide-react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  // Prioridade: media_url > content (se for link de imagem) > body
  const mediaUrl = (message as any).media_url || message.media_url;
  let content = message.content || message.body || "";
  
  // Fallback seguro para o tipo
  const type = (message as any).type || message.message_type || 'text';
  const isMe = message.from_me;

  // Se for texto puro e tiver links, formatamos depois
  // Se for media, o content vira a legenda (caption)

  // 1. IMAGEM
  if (type === 'image') {
    const src = mediaUrl || (content.startsWith('http') || content.startsWith('data:') ? content : null);
    
    return (
      <div className="space-y-1">
        <div className="relative mt-1 overflow-hidden rounded-lg bg-black/20 border border-white/10 group cursor-pointer">
            {src ? (
                <img 
                src={src} 
                alt="Imagem" 
                className="max-w-[280px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" 
                loading="lazy"
                onClick={() => window.open(src, '_blank')}
                />
            ) : (
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                    <span className="text-xs ml-2">Imagem indisponível</span>
                </div>
            )}
        </div>
        {content && content !== src && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
      </div>
    );
  }

  // 2. ÁUDIO (Voice Note ou Audio File)
  if (type === 'audio' || type === 'ptt') {
    return (
      <div className={cn(
          "flex items-center gap-3 min-w-[240px] mt-1 p-2 rounded-lg border transition-all",
          isMe ? "bg-primary/20 border-primary/30" : "bg-zinc-800/80 border-zinc-700"
      )}>
        <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            isMe ? "bg-primary text-primary-foreground" : "bg-zinc-700 text-zinc-400"
        )}>
            <PlayCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
            <audio controls className="h-8 w-full max-w-[200px] opacity-90 scale-[0.85] origin-left filter hue-rotate-15">
                <source src={mediaUrl || content} />
            </audio>
        </div>
      </div>
    );
  }

  // 3. VÍDEO
  if (type === 'video') {
    const src = mediaUrl || (content.startsWith('http') ? content : null);
    return (
      <div className="space-y-1">
        <div className="relative mt-1 overflow-hidden rounded-lg bg-black border border-zinc-800 max-w-[280px]">
            {src ? (
                <video controls className="w-full rounded-lg" preload="metadata">
                    <source src={src} />
                    Seu navegador não suporta vídeos.
                </video>
            ) : (
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800">
                    <Film className="w-8 h-8 opacity-50" />
                </div>
            )}
        </div>
        {content && content !== src && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
      </div>
    );
  }

  // 4. DOCUMENTO
  if (type === 'document') {
    const fileName = (message as any).fileName || content.split('/').pop()?.split('?')[0] || 'Documento';
    const src = mediaUrl || content;

    return (
      <div 
        onClick={() => window.open(src, '_blank')}
        className={cn(
            "flex items-center gap-3 p-3 mt-1 rounded-md border cursor-pointer transition-all group max-w-[280px]",
            isMe ? "bg-primary/10 border-primary/20 hover:bg-primary/20" : "bg-zinc-800/80 border-zinc-700 hover:bg-zinc-800"
        )}
      >
        <div className={cn("p-2 rounded-full", isMe ? "bg-primary/20" : "bg-zinc-900/50")}>
          <FileText className={cn("w-5 h-5", isMe ? "text-primary" : "text-emerald-500")} />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </p>
          <span className="text-[10px] opacity-70 uppercase tracking-wide">Clique para baixar</span>
        </div>
        <Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
      </div>
    );
  }

  // 5. LOCALIZAÇÃO
  if (type === 'location') {
    const cleanCoords = content.replace('Loc:', '').trim();
    const mapsUrl = `https://www.google.com/maps?q=${cleanCoords}`;
    
    return (
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 mt-1 rounded bg-zinc-950/30 hover:bg-zinc-950/50 transition-colors group border border-white/10">
        <div className="p-2 bg-red-500/10 rounded-full">
            <MapPin className="w-4 h-4 text-red-500 group-hover:animate-bounce" />
        </div>
        <span className="text-sm underline decoration-dotted underline-offset-4">
            Ver localização no Maps
        </span>
      </a>
    );
  }

  // 6. ENQUETE (POLL)
  if (type === 'poll') {
    let pollData = { name: 'Enquete', options: [] };
    try {
        pollData = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : { name: content, options: [] };
    } catch (e) {}

    return (
        <div className={cn(
            "rounded-lg p-3 min-w-[250px] space-y-3 mt-1",
            isMe ? "bg-primary/5 border border-primary/20" : "bg-zinc-900/50 border border-zinc-700"
        )}>
            <div className="flex items-start gap-2 border-b border-white/5 pb-2">
                <BarChart2 className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <span className="font-bold text-sm leading-tight">{pollData.name}</span>
            </div>
            <div className="space-y-2">
                {pollData.options?.map((opt: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/5 text-xs hover:bg-white/5 cursor-pointer transition-colors">
                        <span>{opt}</span>
                        <div className="w-4 h-4 rounded-full border border-zinc-500"></div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  // 7. FIGURINHA
  if (type === 'sticker') {
    return (
      <img 
        src={mediaUrl || content} 
        alt="Sticker" 
        className="w-28 h-28 object-contain mt-1 drop-shadow-md hover:scale-110 transition-transform cursor-pointer" 
      />
    );
  }

  // PADRÃO: TEXTO COM LINKS
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