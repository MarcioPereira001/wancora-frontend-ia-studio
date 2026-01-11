"use client";

import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon } from "lucide-react";
import { Message } from "@/types";

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  const content = message.content || message.body || "";
  // Fallback seguro para o tipo
  const type = (message as any).type || message.message_type || 'text';

  // 1. IMAGEM
  if (type === 'image') {
    return (
      <div className="relative mt-1 overflow-hidden rounded-lg border border-white/10 bg-black/20">
        {content.startsWith('http') || content.startsWith('data:') ? (
            <img 
            src={content} 
            alt="Imagem" 
            className="max-w-[280px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity" 
            loading="lazy"
            onClick={() => window.open(content, '_blank')}
            />
        ) : (
            <div className="h-32 w-48 flex items-center justify-center text-zinc-500">
                <ImageIcon className="w-8 h-8 opacity-50" />
            </div>
        )}
      </div>
    );
  }

  // 2. ÁUDIO
  if (type === 'audio') {
    return (
      <div className="flex items-center gap-3 min-w-[240px] mt-1 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <PlayCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
            <audio controls className="h-8 w-full max-w-[200px] opacity-80 scale-90 origin-left">
                <source src={content} type="audio/ogg" />
                <source src={content} type="audio/mp3" />
                <source src={content} type="audio/mpeg" />
            </audio>
        </div>
      </div>
    );
  }

  // 3. VÍDEO
  if (type === 'video') {
    return (
      <div className="relative mt-1 overflow-hidden rounded-lg bg-black border border-zinc-800">
        <video controls className="max-w-[280px] rounded-lg">
          <source src={content} />
          Formato de vídeo não suportado.
        </video>
      </div>
    );
  }

  // 4. DOCUMENTO
  if (type === 'document') {
    const fileName = content.split('/').pop()?.split('?')[0] || 'Documento';
    return (
      <div className="flex items-center gap-3 p-3 mt-1 rounded-md bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-800 transition-colors group cursor-pointer" onClick={() => window.open(content, '_blank')}>
        <div className="p-2 bg-emerald-500/10 rounded-full group-hover:bg-emerald-500/20 transition-colors">
          <FileText className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium text-zinc-200 truncate max-w-[150px]" title={fileName}>
            {fileName}
          </p>
          <span className="text-xs text-zinc-500">Clique para baixar</span>
        </div>
        <Download className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" />
      </div>
    );
  }

  // 5. LOCALIZAÇÃO
  if (type === 'location') {
    const cleanCoords = content.replace('Loc:', '').trim();
    const mapsUrl = `https://www.google.com/maps?q=${cleanCoords}`;
    
    return (
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 mt-1 rounded bg-zinc-800/80 hover:bg-zinc-800 transition-colors group border border-zinc-700/50">
        <div className="p-2 bg-red-500/10 rounded-full">
            <MapPin className="w-4 h-4 text-red-500 group-hover:animate-bounce" />
        </div>
        <span className="text-sm text-zinc-300 group-hover:text-white underline decoration-zinc-600 underline-offset-4">
            Ver localização no Maps
        </span>
      </a>
    );
  }

  // 6. FIGURINHA
  if (type === 'sticker') {
    return (
      <img 
        src={content} 
        alt="Sticker" 
        className="w-28 h-28 object-contain mt-1 drop-shadow-md hover:scale-105 transition-transform" 
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