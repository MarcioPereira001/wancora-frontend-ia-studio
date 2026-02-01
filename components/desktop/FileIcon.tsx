
import React from 'react';
import { DriveFile } from '@/types';
import { Folder, FileText, Image as ImageIcon, Film, Music, FileCode, File } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileIconProps {
  file: DriveFile;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onNavigate: () => void;
}

export const FileIcon: React.FC<FileIconProps> = ({ file, selected, onSelect, onNavigate }) => {
  
  const getIcon = () => {
      if (file.is_folder) return <Folder className="w-12 h-12 text-blue-500 fill-blue-500/20" />;
      
      const mime = file.mime_type;
      if (mime.includes('image')) return <ImageIcon className="w-10 h-10 text-purple-400" />;
      if (mime.includes('pdf')) return <FileText className="w-10 h-10 text-red-500" />;
      if (mime.includes('video')) return <Film className="w-10 h-10 text-pink-500" />;
      if (mime.includes('audio')) return <Music className="w-10 h-10 text-yellow-500" />;
      if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileCode className="w-10 h-10 text-green-500" />;
      
      return <File className="w-10 h-10 text-zinc-400" />;
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(e.ctrlKey || e.metaKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (file.is_folder) {
          onNavigate();
      } else {
          // Preview (Abrir em nova aba por enquanto)
          if(file.web_view_link) window.open(file.web_view_link, '_blank');
      }
  };

  return (
    <div 
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
            "flex flex-col items-center justify-start p-3 rounded-xl border border-transparent transition-all cursor-pointer group w-[110px] h-[130px]",
            selected ? "bg-blue-500/20 border-blue-500/50" : "hover:bg-zinc-800/50"
        )}
        title={file.name}
    >
        <div className="flex-1 flex items-center justify-center relative">
            {/* Thumbnail para imagens (Se disponível e não for pasta) */}
            {file.thumbnail_link && !file.is_folder ? (
                <img src={file.thumbnail_link} alt={file.name} className="w-full h-20 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
            ) : (
                getIcon()
            )}
        </div>
        <span className={cn(
            "text-xs text-center mt-2 truncate w-full px-1 rounded",
            selected ? "text-blue-100 font-medium bg-blue-500/20" : "text-zinc-300"
        )}>
            {file.name}
        </span>
    </div>
  );
};
