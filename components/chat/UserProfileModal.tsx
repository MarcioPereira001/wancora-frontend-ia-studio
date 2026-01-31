
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { User, Camera, Save, Loader2, RefreshCw } from 'lucide-react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { useAuthStore } from '@/store/useAuthStore';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function UserProfileModal({ isOpen, onClose, sessionId }: UserProfileModalProps) {
  const { addToast } = useToast();
  const { user } = useAuthStore();
  const { instances, refreshInstances } = useRealtimeStore();
  
  // Encontra instância atual
  const currentInstance = instances.find(i => i.session_id === sessionId);

  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateName = async () => {
      if(!newName.trim()) return;
      setLoading(true);
      try {
          await api.post('/management/profile/update', { sessionId, action: 'name', value: newName });
          addToast({ type: 'success', title: 'Atualizado', message: 'Nome do perfil alterado.' });
          setNewName('');
          if(user?.company_id) refreshInstances(user.company_id);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  const handleUpdateStatus = async () => {
      if(!newStatus.trim()) return;
      setLoading(true);
      try {
          await api.post('/management/profile/update', { sessionId, action: 'status', value: newStatus });
          addToast({ type: 'success', title: 'Atualizado', message: 'Recado (Bio) alterado.' });
          setNewStatus('');
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.company_id) return;
      setLoading(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, user.company_id);
          await api.post('/management/profile/update', { sessionId, action: 'picture', value: publicUrl });
          addToast({ type: 'success', title: 'Sucesso', message: 'Foto de perfil atualizada.' });
          refreshInstances(user.company_id);
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil (WhatsApp)" maxWidth="sm">
        <div className="flex flex-col items-center space-y-6 py-4">
            
            {/* Foto */}
            <div className="relative group w-28 h-28">
                <div className="w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-700 overflow-hidden shadow-xl">
                    {currentInstance?.profile_pic_url ? (
                        <img src={currentInstance.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><User className="w-10 h-10 text-zinc-500" /></div>
                    )}
                </div>
                <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm">
                    <Camera className="w-8 h-8 text-white mb-1" />
                    <span className="text-[10px] text-white font-bold uppercase">Alterar</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleUploadPhoto} />
                </label>
            </div>

            {/* Info Atual */}
            <div className="text-center">
                <h3 className="text-xl font-bold text-white">{currentInstance?.name || 'WhatsApp User'}</h3>
                <p className="text-sm text-zinc-500 font-mono mt-1">{sessionId}</p>
            </div>

            {/* Edição */}
            <div className="w-full space-y-4">
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Novo Nome</label>
                    <div className="flex gap-2">
                        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Seu nome público" className="bg-zinc-950 border-zinc-800" />
                        <Button size="icon" onClick={handleUpdateName} disabled={loading}><Save className="w-4 h-4" /></Button>
                    </div>
                </div>

                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Recado (Bio)</label>
                    <div className="flex gap-2">
                        <Input value={newStatus} onChange={e => setNewStatus(e.target.value)} placeholder="Available / Ocupado" className="bg-zinc-950 border-zinc-800" />
                        <Button size="icon" onClick={handleUpdateStatus} disabled={loading}><Save className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>

            {loading && <div className="flex items-center gap-2 text-primary text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Atualizando...</div>}
        </div>
    </Modal>
  );
}
