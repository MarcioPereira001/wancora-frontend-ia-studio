
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatContact } from '@/types';
import { 
    Users, MoreVertical, Archive, Tag, Trash2, 
    Camera, Mic, Video, FileText, MapPin, BarChart2, DollarSign, Sticker, RotateCcw
} from 'lucide-react';
import { cn, getDisplayName } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatListItemProps {
    contact: ChatContact;
    isActive: boolean;
    onClick: () => void;
    onTag: () => void;
    onHide: () => void;
    onDelete: () => void;
    isArchived?: boolean; 
}

export function ChatListItem({ contact, isActive, onClick, onTag, onHide, onDelete, isArchived }: ChatListItemProps) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const displayName = getDisplayName(contact);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
            }
        }
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => { document.removeEventListener("mousedown", handleClickOutside); };
    }, [showMenu]);

    const formatTime = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    };

    const getMessagePreview = () => {
        const type = contact.last_message_type || 'text';
        let content = contact.last_message_content || '';
        const iconClass = "w-3 h-3 inline-block mr-1 opacity-70";

        if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
            try {
                const parsed = JSON.parse(content);
                if (type === 'poll') content = parsed.name || 'Enquete';
                else if (type === 'location') content = 'Localização';
                else if (type === 'contact') content = parsed.displayName || 'Contato';
            } catch(e) {}
        }

        switch (type) {
            case 'image': return <span className="flex items-center"><Camera className={iconClass} /> Foto</span>;
            case 'video': return <span className="flex items-center"><Video className={iconClass} /> Vídeo</span>;
            case 'audio': case 'ptt': case 'voice': return <span className="flex items-center"><Mic className={iconClass} /> Áudio</span>;
            case 'document': return <span className="flex items-center"><FileText className={iconClass} /> Documento</span>;
            case 'sticker': return <span className="flex items-center"><Sticker className={iconClass} /> Figurinha</span>;
            case 'location': return <span className="flex items-center"><MapPin className={iconClass} /> Loc</span>;
            case 'poll': return <span className="flex items-center"><BarChart2 className={iconClass} /> Enquete</span>;
            case 'pix': return <span className="flex items-center"><DollarSign className={iconClass} /> Pix</span>;
            default: return <span className="truncate block">{content || 'Mensagem'}</span>;
        }
    };

    return (
        <div 
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-all border-b border-zinc-800/30 group relative pr-8", 
                isActive ? "bg-zinc-800/80 border-l-2 border-l-primary" : "border-l-2 border-l-transparent",
                isArchived && "opacity-70 grayscale"
            )}
        >
            <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-500 overflow-hidden border border-zinc-700/50">
                    {contact.profile_pic_url ? (
                        <img 
                            src={contact.profile_pic_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        (contact.is_group) ? <Users className="w-5 h-5 text-zinc-500" /> :
                        displayName.charAt(0).toUpperCase()
                    )}
                </div>
                
                {contact.is_online && !contact.is_group && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-900 rounded-full animate-in zoom-in duration-300"></div>
                )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <div className="flex justify-between items-baseline">
                    <h3 className={cn("text-sm font-medium truncate flex items-center gap-1", isActive ? "text-white" : "text-zinc-200")}>
                        {displayName}
                        {contact.is_business && !contact.is_group && (
                            <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1 rounded border border-zinc-600 ml-1">BIZ</span>
                        )}
                    </h3>
                    <span className={cn("text-[10px] shrink-0 font-medium", contact.unread_count > 0 ? "text-green-500" : "text-zinc-500")}>
                        {formatTime(contact.last_message_time)}
                    </span>
                </div>
                
                <div className="flex justify-between items-center h-5">
                    <div className={cn("text-xs truncate max-w-[160px] flex items-center gap-1", isActive ? "text-zinc-300" : "text-zinc-400")}>
                        {getMessagePreview()}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {contact.unread_count > 0 && (
                            <span className="bg-green-500 text-black text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-300 px-1">
                                {contact.unread_count}
                            </span>
                        )}
                    </div>
                </div>

                {(contact.stage_name || (contact.lead_tags && contact.lead_tags.length > 0)) && (
                    <div className="flex items-center gap-1 mt-1 overflow-hidden h-4">
                        {contact.stage_name && (
                            <span 
                                className="text-[9px] px-1.5 rounded-sm font-bold uppercase truncate max-w-[80px]" 
                                style={{ backgroundColor: `${contact.stage_color || '#3b82f6'}20`, color: contact.stage_color || '#3b82f6' }}
                            >
                                {contact.stage_name}
                            </span>
                        )}
                        {contact.lead_tags?.slice(0, 2).map((tag, idx) => (
                            <span key={`${contact.id}-tag-${idx}`} className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 rounded-sm truncate max-w-[60px]">
                                {tag}
                            </span>
                        ))}
                        {(contact.lead_tags?.length || 0) > 2 && <span className="text-[9px] text-zinc-600">...</span>}
                    </div>
                )}
            </div>

            <div 
                ref={menuRef}
                className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()} 
            >
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 bg-zinc-900/80 hover:bg-zinc-800 shadow-sm border border-zinc-700 text-zinc-400"
                    onClick={() => setShowMenu(!showMenu)}
                >
                    <MoreVertical className="w-3.5 h-3.5" />
                </Button>

                {showMenu && (
                    <div className="absolute right-0 top-8 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-white/5">
                        {!isArchived && (
                            <button onClick={() => { onTag(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5" /> Etiquetar
                            </button>
                        )}
                        
                        <button onClick={() => { onHide(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2">
                            {isArchived ? (
                                <><RotateCcw className="w-3.5 h-3.5" /> Restaurar</>
                            ) : (
                                <><Archive className="w-3.5 h-3.5" /> Ocultar Conversa</>
                            )}
                        </button>
                        
                        <div className="h-px bg-zinc-800 my-1"></div>
                        <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
