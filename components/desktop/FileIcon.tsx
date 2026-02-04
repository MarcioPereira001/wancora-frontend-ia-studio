
import React from 'react';
import { DriveFile } from '@/types';
import { 
    Folder, FileText, Image as ImageIcon, Film, Music, FileCode, File, 
    CheckCircle2, FileSpreadsheet, FileArchive, LayoutTemplate 
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
      return "w-[120px] h-[140px]"; // Default MD
  }

  const getIconSize = () => {
      if (size === 'sm') return "w-10 h-10";
      if (size === 'lg') return "w-20 h-20";
      return "w-14 h-14";
  }

  // Renderiza o ícone correto baseado no MimeType
  const renderIcon = () => {
      const mime = file.mime_type;
      const s = getIconSize();

      // PASTA (Amarelo Windows)
      if (file.is_folder) {
          return (
              <div className="relative">
                  <Folder className={cn(s, "text-yellow-400 fill-yellow-400/20 drop-shadow-sm")} />
                  {/* Detalhe visual de pasta cheia se quiser adicionar depois */}
              </div>
          );
      }

      // IMAGEM (Thumbnail ou Ícone Roxo)
      if (mime.includes('image')) {
          return <ImageIcon className={cn(s, "text-purple-500 fill-purple-100")} />;
      }

      // PDF (Vermelho)
      if (mime.includes('pdf')) {
          return (
              <div className="relative flex items-center justify-center">
                  <File className={cn(s, "text-red-100 fill-red-500")} />
                  <span className="absolute text-[8px] font-bold text-white mb-1">PDF</span>
              </div>
          );
      }

      // WORD / DOCS (Azul)
      if (mime.includes('word') || mime.includes('document')) {
          return (
              <div className="relative flex items-center justify-center">
                  <FileText className={cn(s, "text-blue-100 fill-blue-600")} />
                  <span className="absolute text-[8px] font-bold text-white mb-2">DOC</span>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30 w-1/2 mx-auto rounded"></div>
              </div>
          );
      }

      // EXCEL / SHEETS (Verde)
      if (mime.includes('spreadsheet') || mime.includes('excel')) {
          return <FileSpreadsheet className={cn(s, "text-green-100 fill-green-600")} />;
      }

      // VIDEO (Rosa)
      if (mime.includes('video')) {
          return <Film className={cn(s, "text-pink-500 fill-pink-100")} />;
      }

      // AUDIO (Amarelo)
      if (mime.includes('audio')) {
          return <Music className={cn(s, "text-yellow-500 fill-yellow-100")} />;
      }

      // ZIP / ARCHIVE (Laranja)
      if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) {
          return <FileArchive className={cn(s, "text-orange-500 fill-orange-100")} />;
      }
      
      // CODE (Cinza)
      if (mime.includes('javascript') || mime.includes('json') || mime.includes('html')) {
          return <FileCode className={cn(s, "text-zinc-400 fill-zinc-800")} />;
      }

      // GENÉRICO (Branco)
      return <File className={cn(s, "text-zinc-300")} />;
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(e.ctrlKey || e.metaKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onNavigate(); // O Pai decide o que fazer (abrir pasta ou preview)
  };

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
            {/* Tenta mostrar thumbnail real se existir e não for pasta */}
            {file.thumbnail_link && !file.is_folder && !file.mime_type.includes('spreadsheet') && !file.mime_type.includes('document') ? (
                <div className="relative shadow-md rounded overflow-hidden bg-white/5">
                     <img 
                        src={file.thumbnail_link} 
                        alt={file.name} 
                        className={cn("object-cover", size === 'lg' ? "h-20" : size === 'sm' ? "h-10" : "h-14")} 
                        referrerPolicy="no-referrer" 
                    />
                </div>
            ) : (
                <div className="drop-shadow-lg filter">
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
