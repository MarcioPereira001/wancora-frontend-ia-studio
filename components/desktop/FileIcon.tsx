
import React from 'react';
import { DriveFile } from '@/types';
import { 
    Folder, FileText, Image as ImageIcon, Film, Music, FileCode, File, 
    CheckCircle2, FileSpreadsheet, FileArchive, LayoutTemplate, CornerUpRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileIconProps {
  file: DriveFile;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onNavigate: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const FileIcon: React.FC<FileIconProps> = ({ file, selected, onSelect, onNavigate, size = 'md' }) => {
  
  const getContainerSize = () => {
      if (size === 'sm') return "w-[90px] h-[100px]";
      if (size === 'lg') return "w-[160px] h-[180px]";
      return "w-[120px] h-[140px]"; 
  }

  const getIconSize = () => {
      if (size === 'sm') return "w-10 h-10";
      if (size === 'lg') return "w-20 h-20";
      return "w-14 h-14";
  }

  const renderIcon = () => {
      const mime = (file.mime_type || '').toLowerCase();
      const name = (file.name || '').toLowerCase();
      const s = getIconSize();

      if (file.is_folder) {
          return <Folder className={cn(s, "text-yellow-400 fill-yellow-400/20 drop-shadow-sm")} />;
      }
      
      // Atalhos
      if (mime.includes('shortcut')) {
          return (
              <div className="relative">
                  <File className={cn(s, "text-blue-200 fill-blue-500/20")} />
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border shadow-sm">
                      <CornerUpRight className="w-3 h-3 text-blue-500" />
                  </div>
              </div>
          );
      }

      // PLANILHAS (Excel, CSV, Google Sheets, ODS, Numbers)
      if (
          mime.includes('spreadsheet') || 
          mime.includes('excel') || 
          mime.includes('csv') || 
          mime.includes('sheet') ||
          name.endsWith('.xlsx') || 
          name.endsWith('.xls') || 
          name.endsWith('.csv') ||
          name.endsWith('.ods') ||
          name.endsWith('.numbers')
      ) {
          return <FileSpreadsheet className={cn(s, "text-green-600 fill-green-100")} />;
      }

      // DOCUMENTOS (Word, Docs, TXT, RTF)
      if (
          mime.includes('document') || 
          mime.includes('word') || 
          name.endsWith('.docx') || 
          name.endsWith('.doc') || 
          name.endsWith('.txt') ||
          name.endsWith('.rtf') ||
          name.endsWith('.odt')
      ) {
          return (
              <div className="relative flex items-center justify-center">
                  <FileText className={cn(s, "text-blue-600 fill-blue-100")} />
                  {(name.endsWith('.doc') || name.endsWith('.docx')) && (
                      <span className="absolute text-[8px] font-bold text-white mb-2 shadow-sm">DOC</span>
                  )}
              </div>
          );
      }

      // APRESENTAÇÕES (PowerPoint, Slides)
      if (
          mime.includes('presentation') || 
          mime.includes('powerpoint') || 
          name.endsWith('.pptx') || 
          name.endsWith('.ppt') ||
          name.endsWith('.odp') ||
          name.endsWith('.key')
      ) {
          return <LayoutTemplate className={cn(s, "text-orange-500 fill-orange-100")} />;
      }

      // PDF
      if (mime.includes('pdf') || name.endsWith('.pdf')) {
          return (
              <div className="relative flex items-center justify-center">
                  <File className={cn(s, "text-red-500 fill-red-100")} />
                  <span className="absolute text-[8px] font-bold text-white mb-1 shadow-sm">PDF</span>
              </div>
          );
      }

      // Imagens
      if (mime.includes('image') || name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.jpeg') || name.endsWith('.gif')) {
          return <ImageIcon className={cn(s, "text-purple-500 fill-purple-100")} />;
      }

      // Vídeos
      if (mime.includes('video') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
          return <Film className={cn(s, "text-pink-500 fill-pink-100")} />;
      }

      // Áudio
      if (mime.includes('audio') || name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg')) {
          return <Music className={cn(s, "text-yellow-500 fill-yellow-100")} />;
      }

      // Arquivos Comprimidos
      if (mime.includes('zip') || mime.includes('compressed') || name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) {
          return <FileArchive className={cn(s, "text-zinc-600 fill-zinc-200")} />;
      }

      // Código
      if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.json')) {
          return <FileCode className={cn(s, "text-slate-600 fill-slate-200")} />;
      }

      // Genérico
      return <File className={cn(s, "text-zinc-400 fill-zinc-100")} />;
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(e.ctrlKey || e.metaKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate();
  };

  // Verifica se deve mostrar thumbnail (apenas imagens e vídeos reais)
  // Bloqueia thumbnail para planilhas e docs para forçar o ícone
  const shouldShowThumbnail = file.thumbnail_link && !file.is_folder && 
      !file.mime_type.includes('spreadsheet') && 
      !file.mime_type.includes('document') && 
      !file.mime_type.includes('presentation') &&
      !file.name.endsWith('.csv') &&
      !file.name.endsWith('.xlsx');

  return (
    <div 
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
            "flex flex-col items-center justify-start p-2 rounded-lg border transition-all cursor-pointer group relative select-none",
            getContainerSize(),
            selected 
                ? "bg-blue-500/20 border-blue-500/50 shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]" 
                : "border-transparent hover:bg-zinc-800/60"
        )}
        title={file.name}
    >
        {selected && (
            <div className="absolute top-1.5 right-1.5 z-10 bg-blue-500 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
        )}

        <div className="flex-1 flex items-center justify-center relative w-full overflow-hidden mb-1">
            {shouldShowThumbnail ? (
                <div className="relative shadow-md rounded overflow-hidden bg-white/5">
                     <img 
                        src={file.thumbnail_link} 
                        alt={file.name} 
                        className={cn("object-cover", size === 'lg' ? "h-20" : size === 'sm' ? "h-10" : "h-14")} 
                        referrerPolicy="no-referrer" 
                    />
                </div>
            ) : (
                <div className="drop-shadow-lg filter transition-transform group-hover:scale-110 duration-200">
                    {renderIcon()}
                </div>
            )}
        </div>
        
        <span className={cn(
            "text-xs text-center mt-1 w-full px-1 rounded break-words line-clamp-2 leading-tight",
            selected ? "text-white font-medium bg-blue-600/40" : "text-zinc-300 group-hover:text-white"
        )}>
            {file.name}
        </span>
    </div>
  );
};
