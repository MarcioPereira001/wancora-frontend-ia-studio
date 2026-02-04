
'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface PreviewAppProps {
  data: {
      url: string;
      type: string;
      id: string;
  };
}

export function PreviewApp({ data }: PreviewAppProps) {
  const { url, type } = data;

  if (!url) return <div className="flex items-center justify-center h-full text-zinc-500">Erro: URL inválida</div>;

  const isImage = type.includes('image');
  const isVideo = type.includes('video');
  const isPdf = type.includes('pdf');

  // Para Google Drive, precisamos ajustar a URL para preview embed se possível
  // A URL que vem do banco geralmente é `webViewLink` ou `thumbnailLink`.
  // Para preview real, webViewLink costuma abrir o viewer do Google em iframe.
  
  // Se for webViewLink, removemos o modo 'view' para tentar embed, ou usamos direto no iframe
  const embedUrl = url.replace('/view', '/preview').replace('&export=download', '');

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
        {isImage ? (
             <img src={url} alt="Preview" className="max-w-full max-h-full object-contain" />
        ) : isVideo ? (
             <video controls className="max-w-full max-h-full" src={url}>
                 Seu navegador não suporta este vídeo.
             </video>
        ) : (
             <iframe 
                src={embedUrl} 
                className="w-full h-full border-none"
                title="Preview"
                allow="autoplay"
             />
        )}
    </div>
  );
}
