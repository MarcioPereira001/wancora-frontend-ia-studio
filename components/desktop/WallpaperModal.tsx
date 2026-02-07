
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { useDesktopStore } from '@/store/useDesktopStore';
import { useToast } from '@/hooks/useToast';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { useAuthStore } from '@/store/useAuthStore';
import { Upload, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Opções predefinidas "Cyberpunk / Wancora Style"
const WALLPAPERS = [
    { id: 1, url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop', name: 'Neon Circuit' },
    { id: 2, url: 'https://images.unsplash.com/photo-1515630278258-407f66498911?q=80&w=2670&auto=format&fit=crop', name: 'Dark City' },
    { id: 3, url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop', name: 'Abstract Flow' },
    { id: 4, url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2670&auto=format&fit=crop', name: 'Matrix Code' },
    { id: 5, url: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop', name: 'Dark Hex' },
    { id: 6, url: 'https://images.unsplash.com/photo-1558494949-ef526b0042a0?q=80&w=2670&auto=format&fit=crop', name: 'Server Room' }
];

interface WallpaperModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WallpaperModal({ isOpen, onClose }: WallpaperModalProps) {
    const { wallpaper, setWallpaper } = useDesktopStore();
    const { user } = useAuthStore();
    const { addToast } = useToast();
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.company_id) return;

        if (!file.type.startsWith('image/')) {
            addToast({ type: 'warning', title: 'Inválido', message: 'Selecione uma imagem válida.' });
            return;
        }

        setUploading(true);
        try {
            // Usa o helper existente para subir no bucket público
            const { publicUrl } = await uploadChatMedia(file, user.company_id);
            setWallpaper(publicUrl);
            addToast({ type: 'success', title: 'Sucesso', message: 'Papel de parede definido.' });
            onClose();
        } catch (error: any) {
            addToast({ type: 'error', title: 'Erro', message: 'Falha ao fazer upload da imagem.' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Papel de Parede" maxWidth="lg">
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                    {WALLPAPERS.map((wp) => (
                        <div 
                            key={wp.id} 
                            onClick={() => setWallpaper(wp.url)}
                            className={cn(
                                "relative aspect-video rounded-lg overflow-hidden cursor-pointer group border-2 transition-all",
                                wallpaper === wp.url ? "border-green-500 ring-2 ring-green-500/30" : "border-transparent hover:border-zinc-500"
                            )}
                        >
                            <img src={wp.url} alt={wp.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                            {wallpaper === wp.url && (
                                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
                                    <Check className="w-3 h-3 text-black" />
                                </div>
                            )}
                            <span className="absolute bottom-2 left-2 text-xs font-bold text-white drop-shadow-md">{wp.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500">Escolha uma imagem ou envie a sua.</p>
                    <label className="cursor-pointer">
                         <Button variant="outline" size="sm" className="gap-2 border-zinc-700 bg-zinc-900" disabled={uploading}>
                             {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                             Carregar do Computador
                         </Button>
                         <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>
            </div>
        </Modal>
    );
}
