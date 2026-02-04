
import React from 'react';
import { DriveFile } from '@/types';
import { Folder, FileText, Image as ImageIcon, Film, Music, FileCode, File, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileIconProps {
  file: DriveFile;
  selected: boolean;
  onSelect: (multi: boolean) => void;
  onNavigate: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const FileIcon: React.FC<FileIconProps> = ({ file, selected, onSelect, onNavigate, size = 'md' }) => {
  
  const getIconSize = () => {
      if (size === 'sm') return "w-8 h-8";
      if (size === 'lg') return "w-16 h-16";
      return "w-12 h-12";
  }

  const getContainerSize = () => {
      if (size === 'sm') return "w-[80px] h-[100px]";
      if (size === 'lg') return "w-[140px] h-[160px]";
      return "w-[110px] h-[130px]";
  }

  const getIcon = () => {
      const s = getIconSize();
      if (file.is_folder) return <Folder className={cn(s, "text-blue-500 fill-blue-500/20")} />;
      
      const mime = file.mime_type;
      if (mime.includes('image')) return <ImageIcon className={cn(s, "text-purple-400")} />;
      if (mime.includes('pdf')) return <FileText className={cn(s, "text-red-500")} />;
      if (mime.includes('video')) return <Film className={cn(s, "text-pink-500")} />;
      if (mime.includes('audio')) return <Music className={cn(s, "text-yellow-500")} />;
      if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileCode className={cn(s, "text-green-500")} />;
      
      return <File className={cn(s, "text-zinc-400")} />;
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
          // Callback para o pai lidar (abrir preview)
      }
  };

  return (
    <div 
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(
            "flex flex-col items-center justify-start p-2 rounded-xl border border-transparent transition-all cursor-pointer group relative",
            getContainerSize(),
            selected ? "bg-blue-500/20 border-blue-500/50" : "hover:bg-zinc-800/50"
        )}
        title={file.name}
    >
        {selected && (
            <div className="absolute top-1 right-1 z-10 text-blue-400">
                <CheckCircle2 className="w-4 h-4 fill-blue-900" />
            </div>
        )}

        <div className="flex-1 flex items-center justify-center relative w-full overflow-hidden">
            {/* Thumbnail para imagens (Se disponível e não for pasta) */}
            {file.thumbnail_link && !file.is_folder ? (
                <img 
                    src={file.thumbnail_link} 
                    alt={file.name} 
                    className={cn("object-cover rounded-lg shadow-sm", size === 'lg' ? "w-full h-24" : size === 'sm' ? "w-full h-12" : "w-full h-16")} 
                    referrerPolicy="no-referrer" 
                />
            ) : (
                getIcon()
            )}
        </div>
        <span className={cn(
            "text-xs text-center mt-2 truncate w-full px-1 rounded select-none",
            selected ? "text-blue-100 font-medium bg-blue-500/20" : "text-zinc-300"
        )}>
            {file.name}
        </span>
    </div>
  );
};
