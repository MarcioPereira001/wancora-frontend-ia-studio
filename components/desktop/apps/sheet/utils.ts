
import { CellData } from './types';

export const DEFAULT_COLS = 26; // A-Z
export const DEFAULT_ROWS = 100;
export const DEFAULT_CELL_WIDTH = 100;
export const DEFAULT_CELL_HEIGHT = 24;

export const getColName = (index: number) => {
    let columnName = "";
    let i = index;
    while (i >= 0) {
        columnName = String.fromCharCode((i % 26) + 65) + columnName;
        i = Math.floor(i / 26) - 1;
    }
    return columnName;
};

export const getCellId = (r: number, c: number) => `${getColName(c)}${r + 1}`;

export const parseCellId = (id: string) => {
    const match = id.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowStr = match[2];
    
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { r: parseInt(rowStr) - 1, c: col - 1 };
};

// --- MOTOR DE FÓRMULAS V2 ---
export const evaluateFormula = (expression: string, cells: Record<string, CellData>): string | number => {
    // 1. Correção Bug do Zero: Se vazio, retorna vazio.
    if (expression === '' || expression === null || expression === undefined) return '';
    
    // Se for número direto, retorna número
    if (!isNaN(Number(expression))) return Number(expression);

    // Se não começa com =, retorna como texto
    if (!expression.startsWith('=')) return expression;

    let cleanExpr = expression.substring(1).toUpperCase().trim();

    try {
        // 2. Resolve Intervalos (ex: A1:A3 -> [A1, A2, A3])
        cleanExpr = cleanExpr.replace(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/g, (match, startId, endId) => {
            const start = parseCellId(startId);
            const end = parseCellId(endId);
            if (!start || !end) return "[]";

            const values = [];
            const minR = Math.min(start.r, end.r);
            const maxR = Math.max(start.r, end.r);
            const minC = Math.min(start.c, end.c);
            const maxC = Math.max(start.c, end.c);

            for (let r = minR; r <= maxR; r++) {
                for (let c = minC; c <= maxC; c++) {
                    const id = getCellId(r, c);
                    const cellVal = cells[id]?.value;
                    // Trata valor vazio como 0 apenas dentro de operações matemáticas de range
                    const val = (cellVal === '' || cellVal === undefined) ? 0 : (cells[id]?.computed || cellVal);
                    values.push(Number(val) || 0);
                }
            }
            return `[${values.join(',')}]`;
        });

        // 3. Resolve Referências Únicas (ex: A1)
        cleanExpr = cleanExpr.replace(/[A-Z]+[0-9]+/g, (match) => {
            const cell = cells[match];
            if (!cell) return "0";
            const val = cell.computed !== undefined ? cell.computed : cell.value;
            // Se for string não numérica, envolve em aspas para o eval
            return isNaN(Number(val)) ? `"${val}"` : String(val || 0);
        });

        // 4. Funções Avançadas (Excel-Like)
        if (cleanExpr.includes('SUM(')) {
            cleanExpr = cleanExpr.replace(/SUM\((.*?)\)/g, (_, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return String(nums.reduce((a: number, b: number) => a + b, 0));
            });
        }
        if (cleanExpr.includes('AVG(') || cleanExpr.includes('MEDIA(')) {
            cleanExpr = cleanExpr.replace(/(AVG|MEDIA)\((.*?)\)/g, (_, __, args) => {
                const nums = args.replace(/\[|\]/g, '').split(',').map((n: string) => Number(n) || 0);
                return nums.length ? String(nums.reduce((a: number, b: number) => a + b, 0) / nums.length) : "0";
            });
        }
        // Novas Funções
        cleanExpr = cleanExpr.replace(/MIN\((.*?)\)/g, (_, args) => `Math.min(${args.replace(/\[|\]/g, '')})`);
        cleanExpr = cleanExpr.replace(/MAX\((.*?)\)/g, (_, args) => `Math.max(${args.replace(/\[|\]/g, '')})`);
        cleanExpr = cleanExpr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/g, "($1 ? $2 : $3)");
        cleanExpr = cleanExpr.replace(/CONCAT\((.*?)\)/g, "($1)"); 

        // 5. Eval Final Seguro
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${cleanExpr}`)();
        
        if (isNaN(result) && typeof result !== 'string') return '#VALOR!';
        if (result === Infinity || result === -Infinity) return '#DIV/0!';
        
        return result;

    } catch (e) {
        return "#ERRO";
    }
};
