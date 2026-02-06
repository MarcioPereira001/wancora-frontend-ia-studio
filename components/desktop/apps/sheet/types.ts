
export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    bg?: string;
    color?: string;
    fontSize?: number;
    format?: 'text' | 'number' | 'currency' | 'percent' | 'date'; // Novo campo
}

export interface CellData {
    value: string; // Valor bruto (ex: "=SUM(A1:B1)" ou "10.5")
    computed?: string | number | null; // Valor calculado (ex: 200)
    style?: CellStyle;
}

export interface SelectionRange {
    start: { r: number, c: number };
    end: { r: number, c: number };
}

export interface SheetState {
    cells: Record<string, CellData>;
    colWidths: Record<number, number>;
    rowHeights: Record<number, number>;
}
