'use client';

import React from 'react';
import { Message } from '@/types';
import { 
  FileText, MapPin, Download, Play, 
  BarChart2, Image as ImageIcon, Film 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  // Normaliza o conteúdo e tipo
  const content = message.content || message.body || "";
  const type = (message as any).type || message.message_type || 'text';
  const isMe = message.from_me;
  
  // Tenta extrair URL de mídia se estiver salva em propriedade separada ou no content
  const mediaUrl = (message as any).media_url || (content.startsWith('http') ? content : null);

  // --- RENDERIZADORES ---

  // 1. IMAGEM
  if (type === 'image') {
    return (
      <div className="space-y-1">
        <div className="relative overflow-hidden rounded-lg bg-black/20 border border-white/5 group">
            {mediaUrl ? (
                <img 
                  src={mediaUrl} 
                  alt="Imagem" 
                  className="max-w-full sm:max-w-[280px] object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => window.open(mediaUrl, '_blank')}
                />
            ) : (
                <div className="flex items-center justify-center w-[200px] h-[150px] bg-zinc-800 text-zinc-500">
                    <ImageIcon className="w-8 h-8" />
                </div>
            )}
        </div>
        {/* Se o content não for a URL, é a legenda */}
        {content && content !== mediaUrl && (
           <p className="text-sm px-1 whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  // 2. VÍDEO
  if (type === 'video') {
    return (
      <div className="space-y-1">
        <div className="relative overflow-hidden rounded-lg bg-black border border-white/5 max-w-[280px]">
          {mediaUrl ? (
             <video controls className="w-full rounded-lg">
               <source src={mediaUrl} />
               Vídeo não suportado.
             </video>
          ) : (
             <div className="flex items-center justify-center w-[200px] h-[150px] bg-zinc-800 text-zinc-500">
                <Film className="w-8 h-8" />
             </div>
          )}
        </div>
        {content && content !== mediaUrl && (
           <p className="text-sm px-1 whitespace-pre-wrap">{content}</p>
        )}
      </div>
    );
  }

  // 3. ÁUDIO (PTT/VOICE NOTE)
  if (type === 'audio') {
    return (
      <div className={cn(
        "flex items-center gap-3 min-w-[220px] p-2 rounded-lg border",
        isMe ? "bg-primary/20 border-primary/30" : "bg-zinc-800 border-zinc-700"
      )}>
        <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            isMe ? "bg-primary text-primary-foreground" : "bg-zinc-700 text-zinc-300"
        )}>
            <Play className="w-5 h-5 ml-1" /> 
        </div>
        <div className="flex-1 flex flex-col justify-center">
            <audio controls className="h-8 w-[180px] opacity-90 scale-y-90 origin-left">
                <source src={mediaUrl || content} />
            </audio>
        </div>
      </div>
    );
  }

  // 4. DOCUMENTO
  if (type === 'document') {
    // Tenta extrair nome do arquivo
    const fileName = (message as any).fileName || content.split('/').pop()?.split('?')[0] || 'Documento';
    
    return (
      <div 
        onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:brightness-110 transition-all max-w-[280px]",
          isMe ? "bg-primary/10 border-primary/20" : "bg-zinc-800 border-zinc-700"
        )}
      >
        <div className="p-2 bg-zinc-950/30 rounded-full">
          <FileText className={cn("w-6 h-6", isMe ? "text-primary" : "text-zinc-400")} />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </p>
          <span className="text-[10px] opacity-70 uppercase">Clique para baixar</span>
        </div>
        <Download className="w-4 h-4 opacity-50" />
      </div>
    );
  }

  // 5. ENQUETE (POLL)
  if (type === 'poll') {
    let pollData = { name: 'Enquete', options: [] };
    try {
        // O backend salva o JSON da enquete no content
        pollData = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : { name: content, options: [] };
    } catch (e) {
        // Fallback
    }

    return (
        <div className={cn(
            "rounded-lg p-3 min-w-[250px] space-y-3",
            isMe ? "bg-primary/5 border border-primary/20" : "bg-zinc-800 border border-zinc-700"
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
            <div className="text-[10px] text-center opacity-50">Enquete</div>
        </div>
    );
  }

  // 6. LOCALIZAÇÃO
  if (type === 'location') {
    const cleanCoords = content.replace('Loc:', '').trim();
    const mapsUrl = `https://www.google.com/maps?q=${cleanCoords}`;
    return (
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded bg-zinc-950/30 border border-white/10 hover:bg-zinc-900 transition-colors">
        <MapPin className="w-5 h-5 text-red-500" />
        <span className="underline decoration-dotted">Ver Localização</span>
      </a>
    );
  }

  // PADRÃO: TEXTO
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => 
        part.match(urlRegex) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{part}</a>
        ) : (
          part
        )
      )}
    </p>
  );
}
