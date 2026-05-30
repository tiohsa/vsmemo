// Utility functions for Markdown table operations
export function generateEmptyTable(rows: number, cols: number, withHeader = true): string[] {
    const header = Array(cols).fill('Header');
    const separator = Array(cols).fill('---');
    const body = Array(rows - (withHeader ? 1 : 0)).fill(null).map(() => Array(cols).fill(''));
    const lines = [];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${separator.join(' | ')} |`);
    for (const row of body) {
        lines.push(`| ${row.join(' | ')} |`);
    }
    return lines;
}

export type ParsedTable = {
    header: string[];
    separator: string[];
    rows: string[][];
};

export function parseMarkdownTable(lines: string[]): ParsedTable {
    const [header, separator, ...rows] = lines.map(line =>
        line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
    );
    return { header, separator, rows };
}

export function isMarkdownTableSeparator(separator: string[]): boolean {
    return separator.length > 0 && separator.every(cell => /^:?-+:?$/.test(cell));
}

export function normalizeTableRows(table: ParsedTable): ParsedTable {
    const columnCount = Math.max(table.header.length, table.separator.length, ...table.rows.map(row => row.length), 0);
    const fillRow = (row: string[]) => [...row, ...Array(columnCount - row.length).fill('')];

    return {
        header: fillRow(table.header),
        separator: fillRow(table.separator).map(cell => cell || '---'),
        rows: table.rows.map(fillRow)
    };
}

export function calculateColumnWidths(table: ParsedTable): number[] {
    const normalizedTable = normalizeTableRows(table);
    return normalizedTable.header.map((headerCell, columnIndex) =>
        Math.max(
            3,
            headerCell.length,
            ...normalizedTable.rows.map(row => row[columnIndex].length)
        )
    );
}

export function formatMarkdownTableRow(row: string[], columnWidths: number[]): string {
    return `| ${columnWidths.map((width, index) => (row[index] ?? '').padEnd(width)).join(' | ')} |`;
}

export function formatMarkdownTable(table: ParsedTable): string[] {
    const normalizedTable = normalizeTableRows(table);
    const columnWidths = calculateColumnWidths(normalizedTable);
    const separator = columnWidths.map((width, columnIndex) => {
        const currentSeparator = normalizedTable.separator[columnIndex];
        const leftAligned = currentSeparator.startsWith(':');
        const rightAligned = currentSeparator.endsWith(':');
        return `${leftAligned ? ':' : ''}${'-'.repeat(width)}${rightAligned ? ':' : ''}`;
    });

    return [
        formatMarkdownTableRow(normalizedTable.header, columnWidths),
        formatMarkdownTableRow(separator, columnWidths),
        ...normalizedTable.rows.map(row => formatMarkdownTableRow(row, columnWidths))
    ];
}

export function stringifyMarkdownTable(table: ParsedTable, format = true): string[] {
    if (format) {
        return formatMarkdownTable(table);
    }

    const lines = [];
    lines.push(`| ${table.header.join(' | ')} |`);
    lines.push(`| ${table.separator.join(' | ')} |`);
    for (const row of table.rows) {
        lines.push(`| ${row.join(' | ')} |`);
    }
    return lines;
}
