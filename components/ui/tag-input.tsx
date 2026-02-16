
'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagInputProps {
  placeholder?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export function TagInput({ placeholder, tags, onChange, maxTags = 20 }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const val = inputValue.trim();
    if (val && !tags.includes(val) && tags.length < maxTags) {
      onChange([...tags, val]);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Digite e pressione Enter..."}
          className="bg-zinc-950 border-zinc-800"
          disabled={tags.length >= maxTags}
        />
        <Button 
          type="button" 
          onClick={handleAdd} 
          disabled={!inputValue.trim() || tags.length >= maxTags}
          variant="secondary"
          className="bg-zinc-800 hover:bg-zinc-700"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <span 
            key={idx} 
            className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 animate-in zoom-in duration-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="hover:text-red-400 focus:outline-none ml-1 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
