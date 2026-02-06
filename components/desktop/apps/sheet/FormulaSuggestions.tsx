
import React from 'react';
import { FunctionSquare } from 'lucide-react';

const FORMULAS = [
    { name: 'SUM', desc: 'Soma um intervalo de células.', example: '=SUM(A1:A5)' },
    { name: 'AVG', desc: 'Média aritmética.', example: '=AVG(B1:B10)' },
    { name: 'MIN', desc: 'Menor valor do intervalo.', example: '=MIN(C1:C5)' },
    { name: 'MAX', desc: 'Maior valor do intervalo.', example: '=MAX(D1:D5)' },
    { name: 'IF', desc: 'Condicional lógico.', example: '=IF(A1>10, "Alto", "Baixo")' },
    { name: 'CONCAT', desc: 'Junta textos.', example: '=CONCAT("Olá ", A1)' },
];

interface FormulaSuggestionsProps {
    query: string;
    onSelect: (formula: string) => void;
}

export function FormulaSuggestions({ query, onSelect }: FormulaSuggestionsProps) {
    // Remove o '=' inicial para filtrar
    const search = query.startsWith('=') ? query.slice(1).toUpperCase() : query.toUpperCase();
    
    const matches = FORMULAS.filter(f => f.name.includes(search));

    if (matches.length === 0) return null;

    return (
        <div className="absolute top-full left-0 z-50 w-64 bg-white border border-zinc-300 rounded-lg shadow-xl mt-1 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-200">
                Fórmulas
            </div>
            <div className="max-h-48 overflow-y-auto">
                {matches.map(f => (
                    <button
                        key={f.name}
                        onClick={() => onSelect(f.name)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-zinc-100 last:border-0 group"
                    >
                        <div className="flex items-center gap-2">
                            <FunctionSquare className="w-3 h-3 text-purple-600" />
                            <span className="font-bold text-sm text-zinc-800">{f.name}</span>
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{f.desc}</p>
                        <p className="text-[10px] text-zinc-400 font-mono bg-zinc-100 inline-block px-1 rounded mt-1 group-hover:bg-blue-100">{f.example}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
