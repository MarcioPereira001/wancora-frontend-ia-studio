"use client";

import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon, Film, BarChart2, User, Copy, QrCode, DollarSign, CheckCircle2 } from "lucide-react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  const { addToast } = useToast();
  const mediaUrl = message.media_url; 
  let content = message.content || message.body || "";
  const type = message.message_type || 'text';
  const isMe = message.from_me;

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Copiado!', message: 'Texto copiado.' });
  };

  // --- 1. IMAGEM ---
  if (type === 'image') {
    return (
      <div className="space-y-1">
        <div className="relative mt-1 overflow-hidden rounded-lg bg-black/20 border border-white/10 group cursor-pointer">
            {mediaUrl ? (
                <img 
                src={mediaUrl} 
                alt="Imagem" 
                className="max-w-[280px] max-h-[300px] object-cover hover:scale-105 transition-transform duration-500" 
                loading="lazy"
                onClick={() => window.open(mediaUrl, '_blank')}
                />
            ) : (
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800">
                    <ImageIcon className="w-8 h-8 opacity-50" />
                    <span className="text-xs ml-2">Carregando imagem...</span>
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
            <PlayCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
            {mediaUrl ? (
                <audio controls className="h-8 w-full max-w-[200px] opacity-90 scale-[0.85] origin-left filter hue-rotate-15">
                    <source src={mediaUrl} />
                </audio>
            ) : (
                <span className="text-xs text-zinc-500">Áudio indisponível</span>
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
                <div className="h-32 w-48 flex items-center justify-center text-zinc-500 bg-zinc-800">
                    <Film className="w-8 h-8 opacity-50" />
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
          <span className="text-[10px] opacity-70 uppercase tracking-wide">Clique para baixar</span>
        </div>
        <Download className="w-4 h-4 opacity-50 group-hover:opacity-100" />
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
    const staticMapUrl = lat && long 
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${long}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${lat},${long}&key=YOUR_API_KEY_HERE` 
        : ''; // Fallback visual below since we don't have API KEY in frontend env usually

    return (
      <div className="mt-1">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-lg border border-white/10 group w-[260px]">
            <div className="bg-zinc-800 h-32 w-full flex items-center justify-center relative overflow-hidden">
                {/* Visual Fake Map Pattern */}
                <div className="absolute inset-0 bg-[#e5e7eb] opacity-80" style={{ 
                    backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg")', 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center',
                    filter: 'grayscale(100%) opacity(0.3)'
                }}></div>
                <div className="bg-red-500 p-2 rounded-full shadow-xl relative z-10 animate-bounce">
                    <MapPin className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <div className="absolute bottom-2 left-2 bg-white/90 text-black text-[10px] px-2 py-1 rounded shadow">
                    {lat?.toFixed(4)}, {long?.toFixed(4)}
                </div>
            </div>
            <div className={cn("p-2 text-xs flex items-center justify-between gap-2", isMe ? "bg-primary/20" : "bg-zinc-900")}>
                <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    <span className="font-bold">Localização Atual</span>
                </div>
                <span className="text-[10px] underline decoration-dotted opacity-70">Abrir Maps</span>
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
             // Fallback legado
             const parts = content.split('|');
             contactData.displayName = parts[0] || 'Contato';
             contactData.vcard = parts[1] || '';
          }
      } catch(e) {}

      // Tenta extrair telefone do vcard se não tiver no JSON
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

  // --- 7. PIX (FIXED LOGIC) ---
  // Apenas considera Pix se o tipo for EXPLICITAMENTE 'pix' OU se começar com "Chave Pix:"
  // Removemos a verificação genérica de length+ponto que quebrava textos longos.
  const isExplicitPix = type === 'pix';
  const isTextPix = type === 'text' && typeof content === 'string' && content.startsWith('Chave Pix:');

  if (isExplicitPix || isTextPix) {
      const pixKey = content.replace('Chave Pix:', '').trim();
      
      return (
          <div className={cn(
              "p-4 mt-1 rounded-xl border space-y-3 min-w-[260px]",
              isMe ? "bg-emerald-900/40 border-emerald-500/30" : "bg-zinc-900 border-zinc-700"
          )}>
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400">
                      <QrCode className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-emerald-400">Pix Copia e Cola</span>
              </div>
              
              <div className="space-y-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Chave</p>
                  <div className="flex items-center gap-2 bg-black/20 p-2 rounded border border-white/5">
                      <code className="text-xs font-mono flex-1 break-all text-zinc-200 line-clamp-2">{pixKey}</code>
                      <button 
                        onClick={() => handleCopy(pixKey)} 
                        className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors shrink-0"
                      >
                          <Copy className="w-3.5 h-3.5" />
                      </button>
                  </div>
              </div>
              
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <DollarSign className="w-3 h-3" />
                  <span>Transferência instantânea</span>
              </div>
          </div>
      );
  }

  // --- 8. ENQUETE ---
  if (type === 'poll') {
    let pollData = { name: 'Enquete', options: [], selectableOptionsCount: 1 };
    try {
        pollData = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : { name: content, options: [] };
    } catch (e) {
        pollData.name = content;
    }

    return (
        <div className={cn(
            "rounded-lg p-3 min-w-[250px] space-y-3 mt-1",
            isMe ? "bg-primary/5 border border-primary/20" : "bg-zinc-900/50 border border-zinc-700"
        )}>
            <div className="flex items-start gap-2 border-b border-white/5 pb-2">
                <BarChart2 className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <span className="font-bold text-sm leading-tight">{pollData.name || 'Pergunta da Enquete'}</span>
            </div>
            <div className="space-y-2">
                {pollData.options?.map((opt: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/5 text-xs hover:bg-white/5 cursor-pointer transition-colors group">
                        <span className="font-medium text-zinc-300">{opt}</span>
                        <div className="w-4 h-4 rounded-full border border-zinc-600 group-hover:border-primary/50"></div>
                    </div>
                ))}
            </div>
            <div className="text-center flex justify-center gap-2 items-center">
                <span className="text-[10px] text-zinc-500 italic">
                    {pollData.selectableOptionsCount > 1 ? 'Múltipla escolha' : 'Opção única'}
                </span>
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