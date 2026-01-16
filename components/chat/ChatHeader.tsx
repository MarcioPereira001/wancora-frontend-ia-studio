'use client';

import React from 'react';
import { ArrowLeft, User, Users, MoreVertical, CheckSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { Button } from '@/components/ui/button';
import { cleanJid } from '@/lib/utils';

export function ChatHeader() {
  const { activeContact, setActiveContact, toggleMsgSelectionMode } = useChatStore();
  const [showOptionsMenu, setShowOptionsMenu] = React.useState(false);

  if (!activeContact) return null;

  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-zinc-900/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={() => setActiveContact(null)}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden">
                    {activeContact.profile_pic_url ? <img src={activeContact.profile_pic_url} className="w-full h-full object-cover" /> : (activeContact.is_group ? <Users className="w-5 h-5 text-zinc-500" /> : <User className="w-5 h-5 text-zinc-500" />)}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{activeContact.name}</h3>
                <p className="text-xs text-zinc-400 font-mono">{cleanJid(activeContact.remote_jid)}</p>
            </div>
        </div>
        
        <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-zinc-400 hover:text-white">
                <MoreVertical className="w-5 h-5" />
            </Button>
            {showOptionsMenu && (
                <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-2 w-48 z-50 animate-in fade-in slide-in-from-top-2">
                    <button 
                        onClick={() => { toggleMsgSelectionMode(); setShowOptionsMenu(false); }} 
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                    >
                        <CheckSquare className="w-4 h-4" /> Selecionar
                    </button>
                    {/* Futuro: Implementar Limpar Chat */}
                    <button className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Limpar</button>
                </div>
            )}
        </div>
    </div>
  );
}