
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDesktopStore } from '@/store/useDesktopStore';
import { useCloudStore } from '@/store/useCloudStore';
import { WindowFrame } from './WindowFrame';
import { DriveApp } from './apps/DriveApp';
import { EditorApp } from './apps/EditorApp';
import { PreviewApp } from './apps/PreviewApp';
import { SheetApp } from './apps/SheetApp'; 
import { Taskbar } from './Taskbar'; 
import { Cloud, Key, FileText, Trash2, FolderPlus, Loader2, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

const DesktopIcon = ({ label, icon: Icon, onOpen, onSelect, color = "text-blue-500", active = false }: any) => (
    <div 
        className={cn(
            "w-24 h-24 flex flex-col items-center justify-center gap-2 rounded-lg transition-colors cursor-pointer group select-none border border-transparent",
            active ? "bg-white/10 border-white/20" : "hover:bg-white/5"
        )}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
        <div className="w-12 h-12 bg-zinc-900/80 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform backdrop-blur-sm">
            <Icon className={cn("w-7 h-7", color)} />
        </div>
        <span className={cn(
            "text-xs text-white font-medium text-center leading-tight drop-shadow-md px-1 rounded",
            active ? "bg-blue-600/80" : "bg-black/20"
        )}>
            {label}
        </span>
    </div>
);

export function DesktopEnvironment() {
  const { windows, openWindow, wallpaper } = useDesktopStore();
  const { setTrashView } = useCloudStore();
  const { user } = useAuthStore();
  const supabase = createClient();
  const { addToast } = useToast();
  
  const desktopConstraintsRef = useRef<HTMLDivElement>(null);
  
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  useEffect(() => {
      const check = async () => {
          if(!user?.company_id) return;
          const { data } = await supabase.from('integrations_google').select('company_id').eq('company_id', user.company_id).maybeSingle();
          setHasIntegration(!!data);
      };
      check();
  }, [user?.company_id]);

  const handleDriveClick = () => {
      if (hasIntegration) {
          setTrashView(false); 
          openWindow('drive', 'Meu Drive');
      } else {
          setShowAuthModal(true);
      }
  };

  const handleTrashClick = async () => {
      if (!hasIntegration) {
          setShowAuthModal(true);
          return;
      }
      setTrashView(true); 
      openWindow('drive', 'Lixeira');
  };

  const startAuth = async () => {
      try {
          const res = await api.post('/cloud/google/connect', { companyId: user?.company_id });
          if (res.url) window.location.href = res.url;
      } catch (e) { alert("Erro de conexão."); }
  };

  return (
    <div 
        ref={desktopConstraintsRef}
        className="absolute inset-0 w-full h-full overflow-hidden bg-cover bg-center select-none"
        style={{ 
            backgroundImage: `url(${wallpaper})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#000'
        }}
        onClick={() => setSelectedIcon(null)}
    >
        {/* Overlay para escurecer o fundo e melhorar contraste */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />

        <div className="absolute top-4 left-4 grid grid-cols-1 gap-2 z-10">
            <DesktopIcon 
                label="Meu Drive" 
                icon={Cloud} 
                color="text-green-400"
                active={selectedIcon === 'drive'}
                onSelect={() => setSelectedIcon('drive')}
                onOpen={handleDriveClick} 
            />
            {!hasIntegration && hasIntegration !== null && (
                 <div className="absolute top-0 right-0 bg-red-500 w-4 h-4 rounded-full border-2 border-zinc-900 flex items-center justify-center animate-pulse pointer-events-none">
                     <span className="text-[8px] font-bold text-white">!</span>
                 </div>
            )}

            <DesktopIcon 
                label="Lixeira" 
                icon={Trash2} 
                color="text-red-400"
                active={selectedIcon === 'trash'}
                onSelect={() => setSelectedIcon('trash')}
                onOpen={handleTrashClick} 
            />

            <DesktopIcon 
                label="Novo Doc" 
                icon={FileText} 
                color="text-blue-400"
                active={selectedIcon === 'word'}
                onSelect={() => setSelectedIcon('word')}
                onOpen={() => openWindow('editor', 'Novo Documento')} 
            />

            <DesktopIcon 
                label="Planilha" 
                icon={FileSpreadsheet} 
                color="text-green-500"
                active={selectedIcon === 'sheet'}
                onSelect={() => setSelectedIcon('sheet')}
                onOpen={() => openWindow('sheet', 'Nova Planilha')} 
            />
        </div>

        <div className="absolute inset-0 pb-12 pointer-events-none overflow-hidden"> 
            {windows.map((win) => (
                <div key={win.id} className="pointer-events-auto">
                    <WindowFrame window={win} constraintsRef={desktopConstraintsRef}>
                        {win.type === 'drive' && <DriveApp />}
                        {win.type === 'editor' && <EditorApp windowId={win.id} />}
                        {win.type === 'sheet' && <SheetApp windowId={win.id} />}
                        {win.type === 'preview' && <PreviewApp data={win.data} />}
                    </WindowFrame>
                </div>
            ))}
        </div>

        <Taskbar />

        <Modal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} title="Conectar Google Drive" maxWidth="sm">
            <div className="flex flex-col items-center text-center p-4">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                    <Key className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Acesso Restrito</h3>
                <p className="text-sm text-zinc-400 mt-2 mb-6">
                    Para acessar seus arquivos e a lixeira, você precisa conectar sua conta Google Drive da empresa.
                </p>
                <Button onClick={startAuth} className="w-full bg-white text-black hover:bg-zinc-200">
                    Conectar Agora
                </Button>
            </div>
        </Modal>
    </div>
  );
}
