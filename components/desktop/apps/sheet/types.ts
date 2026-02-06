
export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    bg?: string;
    color?: string;
    fontSize?: number;
}

export interface CellData {
    value: string;
    computed?: string | number | null;
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
