"use client";

import { FileText, MapPin, Download, PlayCircle, Image as ImageIcon, Film, BarChart2, User, Copy, QrCode, DollarSign } from "lucide-react";
import { Message } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

interface MessageContentProps {
  message: Message;
}

export function MessageContent({ message }: MessageContentProps) {
  const { addToast } = useToast();
  // O Backend agora salva a URL pública do Supabase Storage em `media_url`.
  // `content` geralmente contém a legenda (caption) para mídias, ou o texto da mensagem.
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
        {content && content !== mediaUrl && (
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
        {content && content !== mediaUrl && (
            <p className="text-sm px-1 whitespace-pre-wrap mt-1">{content}</p>
        )}
      </div>
    );
  }

  // --- 4. DOCUMENTO ---
  if (type === 'document') {
    // Tenta pegar fileName salvo ou extrair da URL
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
    // Tenta parsear se for JSON ou string simples
    let coords = content;
    try {
        const parsed = JSON.parse(content);
        if(parsed.latitude && parsed.longitude) {
            coords = `${parsed.latitude},${parsed.longitude}`;
        }
    } catch(e) {
        coords = content.replace('Loc:', '').trim();
    }
    
    const mapsUrl = `https://www.google.com/maps?q=${coords}`;
    
    return (
      <div className="mt-1">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-lg border border-white/10 group">
            <div className="bg-zinc-800 h-32 w-64 flex items-center justify-center relative">
                <div className="absolute inset-0 opacity-50 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=0,0&zoom=1&size=600x300')] bg-cover bg-center filter grayscale group-hover:grayscale-0 transition-all"></div>
                <div className="bg-red-500/20 p-3 rounded-full animate-ping absolute"></div>
                <MapPin className="w-8 h-8 text-red-500 relative z-10 drop-shadow-lg" />
            </div>
            <div className={cn("p-2 text-xs flex items-center gap-2", isMe ? "bg-primary/20" : "bg-zinc-900")}>
                <MapPin className="w-3 h-3" />
                <span className="underline decoration-dotted underline-offset-2">Ver no Maps</span>
            </div>
          </a>
      </div>
    );
  }

  // --- 6. CONTATO ---
  if (type === 'contact') {
      let contactData = { displayName: 'Contato', vcard: '' };
      try {
          if(content.startsWith('{')) {
             const parsed = JSON.parse(content);
             contactData.displayName = parsed.displayName || parsed.name || 'Contato';
             contactData.vcard = parsed.vcard || '';
          } else {
             const parts = content.split('|');
             if(parts.length > 1) {
                 contactData.displayName = parts[0];
                 contactData.vcard = parts[1];
             } else {
                 contactData.displayName = 'Contato';
                 contactData.vcard = content;
             }
          }
      } catch(e) {}

      // Extrai telefone do vcard se possível
      const phoneMatch = contactData.vcard.match(/TEL.*:(.*)/);
      const phone = phoneMatch ? phoneMatch[1] : 'Ver detalhes';

      return (
          <div className={cn(
              "flex items-center gap-3 p-3 mt-1 rounded-lg border min-w-[240px]",
              isMe ? "bg-primary/10 border-primary/20" : "bg-zinc-800 border-zinc-700"
          )}>
              <div className="w-10 h-10 rounded-full bg-zinc-500/20 flex items-center justify-center text-zinc-300">
                  <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{contactData.displayName}</p>
                  <p className="text-xs opacity-70 truncate">{phone}</p>
              </div>
              <button 
                onClick={() => {
                    const blob = new Blob([contactData.vcard], { type: 'text/vcard' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `${contactData.displayName}.vcf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Salvar Contato"
              >
                  <Download className="w-4 h-4" />
              </button>
          </div>
      );
  }

  // --- 7. PIX (Custom Type) ---
  // Verifica tipo explícito 'pix' OU se o texto parece uma chave pix
  if (type === 'pix' || (type === 'text' && (content.includes('Chave Pix:') || content.length > 20 && content.includes('.')))) {
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
                  <span className="font-bold text-sm text-emerald-400">Pagamento via Pix</span>
              </div>
              
              <div className="space-y-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Chave Pix</p>
                  <div className="flex items-center gap-2 bg-black/20 p-2 rounded border border-white/5">
                      <code className="text-xs font-mono flex-1 break-all text-zinc-200">{pixKey}</code>
                      <button 
                        onClick={() => handleCopy(pixKey)} 
                        className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
                      >
                          <Copy className="w-3.5 h-3.5" />
                      </button>
                  </div>
              </div>
              
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                  <DollarSign className="w-3 h-3" />
                  <span>Envie o comprovante após pagar.</span>
              </div>
          </div>
      );
  }

  // --- 8. ENQUETE ---
  if (type === 'poll') {
    let pollData = { name: 'Enquete', options: [] };
    try {
        pollData = typeof content === 'string' && content.startsWith('{') ? JSON.parse(content) : { name: content, options: [] };
    } catch (e) {
        // Fallback se JSON falhar
        pollData.name = content;
    }

    return (
        <div className={cn(
            "rounded-lg p-3 min-w-[250px] space-y-3 mt-1",
            isMe ? "bg-primary/5 border border-primary/20" : "bg-zinc-900/50 border border-zinc-700"
        )}>
            <div className="flex items-start gap-2 border-b border-white/5 pb-2">
                <BarChart2 className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <span className="font-bold text-sm leading-tight">{pollData.name || 'Enquete'}</span>
            </div>
            <div className="space-y-2">
                {pollData.options?.map((opt: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/5 text-xs hover:bg-white/5 cursor-pointer transition-colors group">
                        <span className="font-medium text-zinc-300">{opt}</span>
                        <div className="w-4 h-4 rounded-full border border-zinc-600 group-hover:border-primary/50"></div>
                    </div>
                ))}
            </div>
            <div className="text-center">
                <span className="text-[10px] text-zinc-500 italic">Votação disponível no WhatsApp</span>
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