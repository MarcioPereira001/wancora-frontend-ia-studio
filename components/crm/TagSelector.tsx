'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Tag, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagSelector({ tags = [], onChange }: TagSelectorProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Busca tags existentes para sugerir
  useEffect(() => {
    if(!user?.company_id) return;
    
    const fetchTags = async () => {
        setLoading(true);
        // Tenta buscar tags únicas da tabela leads. 
        // Nota: Idealmente seria uma tabela separada ou RPC, mas vamos fazer distinct na aplicação para simplificar
        const { data } = await supabase
            .from('leads')
            .select('tags')
            .eq('company_id', user.company_id)
            .limit(50);
        
        if (data) {
            const allTags = new Set<string>();
            data.forEach(row => {
                if(Array.isArray(row.tags)) row.tags.forEach((t: string) => allTags.add(t));
            });
            // Adiciona padrões
            ['Quente', 'Novo', 'Retorno', 'WhatsApp'].forEach(t => allTags.add(t));
            setSuggestions(Array.from(allTags));
        }
        setLoading(false);
    };
    fetchTags();
  }, [user?.company_id]);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  return (
    <div className="space-y-3">
      {/* Input Area */}
      <div className="relative">
        <Tag className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar tag..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-10 text-sm text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-all placeholder:text-zinc-600"
        />
        <button 
            type="button"
            onClick={() => handleAddTag(inputValue)}
            disabled={!inputValue.trim()}
            className="absolute right-1.5 top-1.5 p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors disabled:opacity-0"
        >
            <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Tags */}
      {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-900/20 text-green-400 border border-green-900/30 animate-in zoom-in duration-200">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-green-200 focus:outline-none ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
      )}

      {/* Suggestions */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Sugestões</p>
        <div className="flex flex-wrap gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-600" /> : 
             suggestions.filter(s => !tags.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 8).map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleAddTag(suggestion)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
              >
                + {suggestion}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}