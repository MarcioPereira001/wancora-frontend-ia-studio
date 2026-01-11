import { Message } from '@/types';
import { Image as ImageIcon, PlayCircle, Video, FileText } from 'lucide-react';

export function MessageContent({ message }: { message: Message }) {
  switch (message.type || message.message_type) { // Handling mixed types from legacy
      case 'image':
          return (
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold opacity-70 mb-1">
                      <ImageIcon className="w-4 h-4" /> Imagem
                  </div>
                  <div className="bg-black/20 rounded-lg overflow-hidden border border-white/10 max-w-xs">
                      {message.content.startsWith('http') ? (
                          <img src={message.content} alt="Mídia" className="w-full h-auto" />
                      ) : (
                          <div className="h-32 flex items-center justify-center">
                            <ImageIcon className="w-10 h-10 opacity-30" />
                          </div>
                      )}
                  </div>
                  {message.content && !message.content.startsWith('http') && <p className="text-sm opacity-90">{message.content}</p>}
              </div>
          );
      case 'audio':
          return (
              <div className="flex items-center gap-3 min-w-[200px]">
                   <div className="w-10 h-10 rounded-full bg-zinc-900/30 flex items-center justify-center shrink-0">
                       <PlayCircle className="w-6 h-6 opacity-80" />
                   </div>
                   <div className="flex-1 space-y-1">
                       <div className="h-1 bg-zinc-500/30 rounded-full w-full overflow-hidden">
                           <div className="h-full bg-current w-1/3 opacity-80"></div>
                       </div>
                       <div className="flex justify-between text-[10px] opacity-60">
                           <span>Audio</span>
                       </div>
                   </div>
              </div>
          );
      case 'video':
           return (
               <div className="space-y-1">
                   <div className="flex items-center gap-2 text-xs font-semibold opacity-70 mb-1">
                       <Video className="w-4 h-4" /> Vídeo
                   </div>
                   <div className="bg-black/20 rounded-lg h-32 w-48 flex items-center justify-center border border-white/10">
                        <PlayCircle className="w-10 h-10 opacity-30" />
                   </div>
                   <p className="text-sm opacity-90">{message.content}</p>
               </div>
           );
      default:
          return <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body || message.content}</p>;
  }
}