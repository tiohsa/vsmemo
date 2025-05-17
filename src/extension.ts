// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';
import { generateEmptyTable, parseMarkdownTable, stringifyMarkdownTable } from './markdownTableUtils';
import { wrapCodeBlock, insertTodayDate } from './markdownEditUtils';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('vsmemo.createDateNote', async () => {
			try {
				const config = vscode.workspace.getConfiguration('vsmemo');
				let dir = config.get<string>('createDirectory')!;
				const format = config.get<string>('fileNameFormat')!;
				if (dir.includes('${workspaceFolder}')) {
					const folders = vscode.workspace.workspaceFolders;
					if (!folders || folders.length === 0) {
						vscode.window.showErrorMessage('No workspace folder is open');
						return;
					}
					dir = dir.replace('${workspaceFolder}', folders[0].uri.fsPath);
				}

				const userTitle = await vscode.window.showInputBox({ prompt: 'Please enter a title' });
				if (!userTitle) {
					vscode.window.showErrorMessage('No title was entered');
					return;
				}

				let dirStat: fs.Stats | undefined;
				try {
					dirStat = await fs.promises.stat(dir);
				} catch (err: any) {
					// Always try mkdir if stat fails (to match test specification)
					try {
						await fs.promises.mkdir(dir, { recursive: true });
					} catch (mkdirErr: any) {
						vscode.window.showErrorMessage('Failed to create note: ' + mkdirErr.message);
						return;
					}
				}

				// If stat succeeds, check if it is a directory
				if (dirStat && !dirStat.isDirectory()) {
					vscode.window.showErrorMessage(`Failed to create note: ${dir} exists but is not a directory`);
					return;
				}

				const userExt = 'md';
				const now = new Date();
				const fileName = format
					.replace(/\$\{yyyy\}/g, formatDate(now, 'yyyy'))
					.replace(/\$\{MM\}/g, formatDate(now, 'MM'))
					.replace(/\$\{dd\}/g, formatDate(now, 'dd'))
					.replace(/\$\{title\}/g, userTitle)
					.replace(/\$\{ext\}/g, userExt);

				const filePath = path.join(dir, fileName);
				await fs.promises.writeFile(filePath, '');
				const doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
			} catch (err: any) {
				vscode.window.showErrorMessage('Failed to create note: ' + err.message);
			}
		}),
		// --- New commands from here ---
		vscode.commands.registerCommand('vsmemo.createTableAtPosition', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const rowStr = await vscode.window.showInputBox({ prompt: 'Enter number of rows', validateInput: v => /^\d+$/.test(v) ? undefined : 'Please enter a number' });
			const colStr = await vscode.window.showInputBox({ prompt: 'Enter number of columns', validateInput: v => /^\d+$/.test(v) ? undefined : 'Please enter a number' });
			if (!rowStr || !colStr) { return; }
			const rows = parseInt(rowStr, 10);
			const cols = parseInt(colStr, 10);
			const withHeader = await vscode.window.showQuickPick(['With header', 'Without header'], { placeHolder: 'Include header row?' });
			const tableLines = generateEmptyTable(rows, cols, withHeader === 'With header');
			await editor.edit(editBuilder => {
				const pos = editor.selection.active;
				editBuilder.insert(pos, tableLines.join('\n') + '\n');
			});
		}),
		vscode.commands.registerCommand('vsmemo.insertColumn', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const cursorLine = editor.selection.active.line;
			const doc = editor.document;
			// Detect table range
			let start = cursorLine, end = cursorLine;
			while (start > 0 && /^\s*\|.*\|\s*$/.test(doc.lineAt(start - 1).text)) { start--; }
			while (end < doc.lineCount - 1 && /^\s*\|.*\|\s*$/.test(doc.lineAt(end + 1).text)) { end++; }
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(doc.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
			// Determine cursor column position
			const cursorChar = editor.selection.active.character;
			const relLine = cursorLine - start;
			const lineText = lines[relLine];
			let colIdx = 0;
			const pipeIdxs = [...lineText.matchAll(/\|/g)].map(m => m.index!);
			for (let i = 0; i < pipeIdxs.length - 1; i++) {
				if (cursorChar >= pipeIdxs[i] && cursorChar < pipeIdxs[i + 1]) {
					colIdx = i;
					break;
				}
			}
			// 右端の列にカーソルがある場合は一番右端に追加
			if (cursorChar >= pipeIdxs[pipeIdxs.length - 1]) {
				colIdx = table.header.length;
			}
			table.header.splice(colIdx, 0, '');
			table.separator.splice(colIdx, 0, '---');
			table.rows = table.rows.map((row: string[]) => { row.splice(colIdx, 0, ''); return row; });
			const newLines = stringifyMarkdownTable(table);
			await editor.edit(editBuilder => {
				const range = new vscode.Range(start, 0, end, lines[lines.length - 1].length);
				editBuilder.replace(range, newLines.join('\n'));
			});
		}),
		vscode.commands.registerCommand('vsmemo.insertRow', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const cursorLine = editor.selection.active.line;
			const doc = editor.document;
			// Detect table range
			let start = cursorLine, end = cursorLine;
			while (start > 0 && /^\s*\|.*\|\s*$/.test(doc.lineAt(start - 1).text)) { start--; }
			while (end < doc.lineCount - 1 && /^\s*\|.*\|\s*$/.test(doc.lineAt(end + 1).text)) { end++; }
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(doc.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
			// カーソル行の下の行に挿入
			const relLine = cursorLine - start;
			let rowIdx = Math.max(0, relLine - 1); // ヘッダー・セパレータ考慮
			if (relLine <= 1) { rowIdx = 0; } // ヘッダー・セパレータの下に挿入
			else if (relLine >= lines.length - 1) { rowIdx = table.rows.length; } // 一番下端なら末尾
			else { rowIdx = relLine - 1; }
			const colCount = table.header.length;
			table.rows.splice(rowIdx, 0, Array(colCount).fill(''));
			const newLines = stringifyMarkdownTable(table);
			await editor.edit(editBuilder => {
				const range = new vscode.Range(start, 0, end, lines[lines.length - 1].length);
				editBuilder.replace(range, newLines.join('\n'));
			});
		}),
		vscode.commands.registerCommand('vsmemo.convertSelectionToTable', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const delimiter = await vscode.window.showInputBox({ prompt: 'Enter delimiter (e.g., , or \\t)' });
			if (!delimiter) { return; }
			const sel = editor.selection;
			const text = editor.document.getText(sel);
			const lines = text.split('\n');
			const cells = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
			const colCount = Math.max(...cells.map(arr => arr.length));
			const header = Array(colCount).fill(''); // empty header
			const separator = Array(colCount).fill('---');
			const body = cells.map(row => {
				const filled = Array(colCount).fill('');
				row.forEach((cell, i) => { filled[i] = cell; });
				return filled;
			});
			const tableLines = [
				`| ${header.join(' | ')} |`,
				`| ${separator.join(' | ')} |`,
				...body.map(row => `| ${row.join(' | ')} |`)
			];
			await editor.edit(editBuilder => {
				editBuilder.replace(sel, tableLines.join('\n'));
			});
		}),
		vscode.commands.registerCommand('vsmemo.deleteColumn', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const cursorLine = editor.selection.active.line;
			const doc = editor.document;
			// テーブル範囲検出
			let start = cursorLine, end = cursorLine;
			while (start > 0 && /^\s*\|.*\|\s*$/.test(doc.lineAt(start - 1).text)) { start--; }
			while (end < doc.lineCount - 1 && /^\s*\|.*\|\s*$/.test(doc.lineAt(end + 1).text)) { end++; }
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(doc.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
			// カーソルの列位置を特定
			const cursorChar = editor.selection.active.character;
			const relLine = cursorLine - start;
			const lineText = lines[relLine];
			let colIdx = 0;
			const pipeIdxs = [...lineText.matchAll(/\|/g)].map(m => m.index!);
			for (let i = 0; i < pipeIdxs.length - 1; i++) {
				if (cursorChar >= pipeIdxs[i] && cursorChar < pipeIdxs[i + 1]) {
					colIdx = i;
					break;
				}
			}
			table.header.splice(colIdx, 1);
			table.separator.splice(colIdx, 1);
			table.rows = table.rows.map((row: string[]) => { row.splice(colIdx, 1); return row; });
			const newLines = stringifyMarkdownTable(table);
			await editor.edit(editBuilder => {
				const range = new vscode.Range(start, 0, end, lines[lines.length - 1].length);
				editBuilder.replace(range, newLines.join('\n'));
			});
		}),
		vscode.commands.registerCommand('vsmemo.deleteRow', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const cursorLine = editor.selection.active.line;
			const doc = editor.document;
			// テーブル範囲検出
			let start = cursorLine, end = cursorLine;
			while (start > 0 && /^\s*\|.*\|\s*$/.test(doc.lineAt(start - 1).text)) { start--; }
			while (end < doc.lineCount - 1 && /^\s*\|.*\|\s*$/.test(doc.lineAt(end + 1).text)) { end++; }
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(doc.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
			// 挿入行位置を特定（ヘッダー・セパレータを除いたデータ行のどこを消すか）
			const relLine = cursorLine - start;
			// relLine=0:ヘッダー, 1:セパレータ, 2以降:データ
			let rowIdx = Math.max(0, relLine - 2);
			if (table.rows.length > 0 && rowIdx < table.rows.length) {
				table.rows.splice(rowIdx, 1);
				const newLines = stringifyMarkdownTable(table);
				await editor.edit(editBuilder => {
					const range = new vscode.Range(start, 0, end, lines[lines.length - 1].length);
					editBuilder.replace(range, newLines.join('\n'));
				});
			}
		}),
		vscode.commands.registerCommand('vsmemo.wrapCodeBlock', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const config = vscode.workspace.getConfiguration('vsmemo');
			const defaultLang = config.get<string>('defaultCodeBlockLanguage', 'mermaid');
			const language = await vscode.window.showInputBox({ prompt: 'コードブロックの言語', value: defaultLang });
			await wrapCodeBlock(editor, language || defaultLang);
		}),
		vscode.commands.registerCommand('vsmemo.insertTodayDate', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const config = vscode.workspace.getConfiguration('vsmemo');
			const dateFormat = config.get<string>('dateFormat', 'yyyy-MM-dd');
			await insertTodayDate(editor, dateFormat);
		}),
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
