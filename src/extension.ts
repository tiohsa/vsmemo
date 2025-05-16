// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';
import { generateEmptyTable, parseMarkdownTable, stringifyMarkdownTable } from './markdownTableUtils';

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
					// stat失敗時は常にmkdirを試みる（テスト仕様に合わせる）
					try {
						await fs.promises.mkdir(dir, { recursive: true });
					} catch (mkdirErr: any) {
						vscode.window.showErrorMessage('Failed to create note: ' + mkdirErr.message);
						return;
					}
				}

				// statが成功した場合はディレクトリかどうかをチェック
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
		// --- ここから新コマンド ---
		vscode.commands.registerCommand('vsmemo.createTableAtPosition', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const rowStr = await vscode.window.showInputBox({ prompt: '行数を入力してください', validateInput: v => /^\d+$/.test(v) ? undefined : '数字を入力してください' });
			const colStr = await vscode.window.showInputBox({ prompt: '列数を入力してください', validateInput: v => /^\d+$/.test(v) ? undefined : '数字を入力してください' });
			if (!rowStr || !colStr) { return; }
			const rows = parseInt(rowStr, 10);
			const cols = parseInt(colStr, 10);
			const withHeader = await vscode.window.showQuickPick(['ヘッダーあり', 'ヘッダーなし'], { placeHolder: 'ヘッダー行を含めますか？' });
			const tableLines = generateEmptyTable(rows, cols, withHeader === 'ヘッダーあり');
			await editor.edit(editBuilder => {
				const pos = editor.selection.active;
				editBuilder.insert(pos, tableLines.join('\n') + '\n');
			});
		}),
		vscode.commands.registerCommand('vsmemo.insertColumn', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const colStr = await vscode.window.showInputBox({ prompt: '挿入する列番号（0始まり）', validateInput: v => /^\d+$/.test(v) ? undefined : '数字を入力してください' });
			if (!colStr) { return; }
			const colIdx = parseInt(colStr, 10);
			const sel = editor.selection;
			const start = sel.start.line;
			const end = sel.end.line;
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(editor.document.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
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
			const rowStr = await vscode.window.showInputBox({ prompt: '挿入する行番号（0始まり, ヘッダー含む）', validateInput: v => /^\d+$/.test(v) ? undefined : '数字を入力してください' });
			if (!rowStr) { return; }
			const rowIdx = parseInt(rowStr, 10);
			const sel = editor.selection;
			const start = sel.start.line;
			const end = sel.end.line;
			const lines: string[] = [];
			for (let i = start; i <= end; i++) { lines.push(editor.document.lineAt(i).text); }
			const table = parseMarkdownTable(lines);
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
			const delimiter = await vscode.window.showInputBox({ prompt: '区切り文字を入力してください（例: , または \t）' });
			if (!delimiter) { return; }
			const sel = editor.selection;
			const text = editor.document.getText(sel);
			const lines = text.split('\n');
			const cells = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
			const colCount = Math.max(...cells.map(arr => arr.length));
			const header = Array(colCount).fill(''); // 空のヘッダ
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
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
