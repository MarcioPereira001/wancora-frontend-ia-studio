
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ChatContact } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { api } from '@/services/api';
import { Users, Lock, Unlock, Megaphone, Link as LinkIcon, Camera, Save, Loader2, Crown, Trash2 } from 'lucide-react';
import { uploadChatMedia } from '@/utils/supabase/storage';
import { cn } from '@/lib/utils';

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ChatContact;
  sessionId: string;
}

export function GroupInfoModal({ isOpen, onClose, contact, sessionId }: GroupInfoModalProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'settings'>('overview');
  
  // States
  const [subject, setSubject] = useState(contact.name || '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  
  const [participants, setParticipants] = useState<any[]>([]); 
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [newParticipant, setNewParticipant] = useState('');

  // Settings
  const [isLocked, setIsLocked] = useState(false); 
  const [isAnnouncement, setIsAnnouncement] = useState(false); 

  // Efeito para carregar participantes quando a aba muda
  useEffect(() => {
      if (isOpen && activeTab === 'participants') {
          fetchParticipants();
      }
  }, [isOpen, activeTab]);

  const fetchParticipants = async () => {
      setLoadingParticipants(true);
      try {
          const res = await api.post('/management/group/metadata', {
              sessionId,
              groupId: contact.remote_jid
          });
          if (res.metadata && res.metadata.participants) {
              setParticipants(res.metadata.participants);
              setDescription(res.metadata.desc || ''); // Aproveita e atualiza a descrição se vier
              setSubject(res.metadata.subject || contact.name);
          }
      } catch (e) {
          console.error("Erro ao buscar participantes:", e);
      } finally {
          setLoadingParticipants(false);
      }
  };

  const handleUpdateSubject = async () => {
      if(!subject.trim()) return;
      setLoading(true);
      try {
          await api.post('/management/group/update', {
              sessionId,
              groupId: contact.remote_jid,
              action: 'subject',
              value: subject
          });
          addToast({ type: 'success', title: 'Atualizado', message: 'Nome do grupo alterado.' });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  const handleUpdateDescription = async () => {
      setLoading(true);
      try {
          await api.post('/management/group/update', {
              sessionId,
              groupId: contact.remote_jid,
              action: 'description',
              value: description
          });
          addToast({ type: 'success', title: 'Atualizado', message: 'Descrição alterada.' });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      try {
          const { publicUrl } = await uploadChatMedia(file, contact.company_id);
          await api.post('/management/group/update', {
              sessionId,
              groupId: contact.remote_jid,
              action: 'picture',
              value: publicUrl
          });
          addToast({ type: 'success', title: 'Sucesso', message: 'Foto do grupo atualizada.' });
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  const fetchInviteLink = async () => {
      try {
          const res = await api.post('/management/group/update', {
              sessionId,
              groupId: contact.remote_jid,
              action: 'invite_code'
          });
          if(res.result?.code) setInviteCode(res.result.code);
      } catch (e) {}
  };

  const handleParticipantAction = async (action: 'add' | 'remove' | 'promote' | 'demote', participantJid: string) => {
      setLoading(true);
      try {
          await api.post('/management/group/update', {
              sessionId,
              groupId: contact.remote_jid,
              action,
              participants: [participantJid]
          });
          addToast({ type: 'success', title: 'Sucesso', message: `Ação ${action} realizada.` });
          fetchParticipants(); // Refresh list
          if(action === 'add') setNewParticipant('');
      } catch (e: any) {
          addToast({ type: 'error', title: 'Erro', message: e.message });
      } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestão do Grupo" maxWidth="lg">
        <div className="flex border-b border-zinc-800 mb-4">
            <button onClick={() => setActiveTab('overview')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'overview' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>Visão Geral</button>
            <button onClick={() => setActiveTab('participants')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'participants' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>Participantes</button>
            <button onClick={() => setActiveTab('settings')} className={cn("px-4 py-2 text-sm font-medium border-b-2 transition-colors", activeTab === 'settings' ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-white")}>Configurações</button>
        </div>

        <div className="min-h-[300px]">
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex items-center gap-4">
                        <div className="relative group w-20 h-20 shrink-0">
                            <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700">
                                {contact.profile_pic_url ? (
                                    <img src={contact.profile_pic_url} className="w-full h-full object-cover" />
                                ) : (
                                    <Users className="w-8 h-8 text-zinc-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                            </div>
                            <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleUploadIcon} />
                            </label>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Nome do Grupo</label>
                            <div className="flex gap-2">
                                <Input value={subject} onChange={e => setSubject(e.target.value)} className="bg-zinc-950 border-zinc-800" />
                                <Button size="icon" onClick={handleUpdateSubject} disabled={loading}><Save className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Descrição</label>
                        <div className="flex gap-2">
                            <Textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="bg-zinc-950 border-zinc-800 min-h-[80px]" 
                                placeholder="Regras do grupo, links importantes..."
                            />
                            <Button size="icon" className="h-auto" onClick={handleUpdateDescription} disabled={loading}><Save className="w-4 h-4" /></Button>
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-full text-blue-400">
                                    <LinkIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Link de Convite</p>
                                    <p className="text-xs text-zinc-500">Permite que pessoas entrem via link.</p>
                                </div>
                            </div>
                            {!inviteCode ? (
                                <Button variant="outline" size="sm" onClick={fetchInviteLink}>Gerar Link</Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Input value={inviteCode} readOnly className="h-8 w-48 text-xs font-mono" />
                                    <Button size="sm" onClick={() => { navigator.clipboard.writeText(inviteCode); addToast({type:'success', title:'Copiado!'}) }}>Copiar</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'participants' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex gap-2">
                        <Input 
                            value={newParticipant} 
                            onChange={e => setNewParticipant(e.target.value)} 
                            placeholder="Adicionar participante (551199...)" 
                            className="bg-zinc-950 border-zinc-800"
                        />
                        <Button onClick={() => handleParticipantAction('add', newParticipant)} disabled={loading || newParticipant.length < 10}>Adicionar</Button>
                    </div>

                    <div className="bg-zinc-900/30 rounded-lg border border-zinc-800 min-h-[300px] overflow-y-auto custom-scrollbar p-2">
                        {loadingParticipants ? (
                            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                        ) : participants.length === 0 ? (
                            <p className="text-center text-zinc-500 py-10 text-sm">Nenhum participante encontrado.</p>
                        ) : (
                            participants.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-900 group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                                            {p.admin ? <Crown className="w-4 h-4 text-yellow-500" /> : <Users className="w-4 h-4 text-zinc-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-zinc-200">{p.id.split('@')[0]}</p>
                                            {p.admin && <span className="text-[10px] text-yellow-600 bg-yellow-500/10 px-1 rounded uppercase font-bold">Admin</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {p.admin ? (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" title="Remover Admin" onClick={() => handleParticipantAction('demote', p.id)}>
                                                <Unlock className="w-3 h-3" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-yellow-500" title="Tornar Admin" onClick={() => handleParticipantAction('promote', p.id)}>
                                                <Crown className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-500" title="Remover" onClick={() => handleParticipantAction('remove', p.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-3">
                            {isLocked ? <Lock className="w-5 h-5 text-red-400" /> : <Unlock className="w-5 h-5 text-green-400" />}
                            <div>
                                <p className="text-sm font-bold text-white">Editar Dados do Grupo</p>
                                <p className="text-xs text-zinc-500">Defina quem pode alterar nome, ícone e descrição.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant={!isLocked ? "secondary" : "ghost"} onClick={() => { setIsLocked(false); api.post('/management/group/update', { sessionId, groupId: contact.remote_jid, action: 'locked', value: false }) }}>Todos</Button>
                            <Button size="sm" variant={isLocked ? "secondary" : "ghost"} onClick={() => { setIsLocked(true); api.post('/management/group/update', { sessionId, groupId: contact.remote_jid, action: 'locked', value: true }) }}>Admins</Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-3">
                            <Megaphone className="w-5 h-5 text-yellow-400" />
                            <div>
                                <p className="text-sm font-bold text-white">Enviar Mensagens</p>
                                <p className="text-xs text-zinc-500">Quem pode enviar mensagens no grupo.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant={!isAnnouncement ? "secondary" : "ghost"} onClick={() => { setIsAnnouncement(false); api.post('/management/group/update', { sessionId, groupId: contact.remote_jid, action: 'announcement', value: false }) }}>Todos</Button>
                            <Button size="sm" variant={isAnnouncement ? "secondary" : "ghost"} onClick={() => { setIsAnnouncement(true); api.post('/management/group/update', { sessionId, groupId: contact.remote_jid, action: 'announcement', value: true }) }}>Admins</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </Modal>
  );
}
