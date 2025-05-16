// Markdownテーブル操作用ユーティリティ関数群
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
        line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
    );
    return { header, separator, rows };
}

export function stringifyMarkdownTable(table: ParsedTable): string[] {
    const lines = [];
    lines.push(`| ${table.header.join(' | ')} |`);
    lines.push(`| ${table.separator.join(' | ')} |`);
    for (const row of table.rows) {
        lines.push(`| ${row.join(' | ')} |`);
    }
    return lines;
}
