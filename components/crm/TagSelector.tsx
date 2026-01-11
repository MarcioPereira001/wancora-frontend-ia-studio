'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TagSelectorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagSelector({ tags = [], onChange, suggestions = ['Importante', 'Novo', 'WhatsApp', 'Email'] }: TagSelectorProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      onChange([...tags, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/20 animate-in zoom-in duration-200">
            {tag}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-1.5 inline-flex items-center justify-center text-primary/70 hover:text-primary focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar tag..."
          className="h-8 text-xs bg-zinc-900 border-zinc-700"
        />
        <Button size="sm" variant="outline" onClick={handleAddTag} className="h-8 px-2 border-zinc-700 hover:bg-zinc-800">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {suggestions.filter(s => !tags.includes(s)).map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onChange([...tags, suggestion])}
            className="text-[10px] px-2 py-1 rounded border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            + {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}