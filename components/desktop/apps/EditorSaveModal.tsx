
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud, Monitor, FileText, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentFilename: string;
    onConfirm: (target: 'drive' | 'local', format: 'docx' | 'pdf', filename: string) => void;
    isSaving: boolean;
}

export function EditorSaveModal({ isOpen, onClose, currentFilename, onConfirm, isSaving }: EditorSaveModalProps) {
    const [activeTab, setActiveTab] = useState<'drive' | 'local'>('drive');
    const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
    const [filename, setFilename] = useState(currentFilename);

    const handleConfirm = () => {
        onConfirm(activeTab, format, filename);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Salvar Documento" maxWidth="sm">
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    <button 
                        onClick={() => setActiveTab('drive')}
                        className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2",
                            activeTab === 'drive' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Cloud size={14} /> Nuvem (Drive)
                    </button>
                    <button 
                        onClick={() => setActiveTab('local')}
                        className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-2",
                            activeTab === 'local' ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Monitor size={14} /> Este Computador
                    </button>
                </div>

                {/* Filename */}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Nome do Arquivo</label>
                    <Input 
                        value={filename} 
                        onChange={(e) => setFilename(e.target.value)} 
                        className="bg-zinc-950 border-zinc-800"
                        placeholder="Meu Documento"
                    />
                </div>

                {/* Formats */}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Formato</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setFormat('docx')}
                            className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                                format === 'docx' ? "bg-blue-500/10 border-blue-500 text-blue-500" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                        >
                            <FileText className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-bold">Word (.docx)</span>
                        </button>
                        <button 
                            onClick={() => setFormat('pdf')}
                            className={cn(
                                "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                                format === 'pdf' ? "bg-red-500/10 border-red-500 text-red-500" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                        >
                            <File className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-bold">PDF (.pdf)</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-2">
                    <Button onClick={handleConfirm} disabled={isSaving || !filename.trim()} className="w-full bg-primary hover:bg-primary/90 text-white">
                        {isSaving ? 'Processando...' : activeTab === 'drive' ? 'Salvar no Drive' : 'Baixar Agora'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
