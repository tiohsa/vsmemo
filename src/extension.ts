// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';
import { generateEmptyTable, isMarkdownTableSeparator, parseMarkdownTable, stringifyMarkdownTable } from './markdownTableUtils';
import { wrapCodeBlock, insertTodayDate } from './markdownEditUtils';
import { NoteItem, SidebarProvider } from './sidebarProvider';
import { DestinationItem, DestinationProvider } from './destinationProvider';
import { NoteHistory } from './noteHistory';
import { MoveHistoryTracker } from './moveHistoryTracker';
import { findNote, isMemoUri, showMemoActions } from './noteUi';
import { DateNoteTemplateError, renderDateNoteTemplate, selectDateNoteTemplate } from './dateNoteTemplate';
import { moveFilesToPresetFolder } from './moveFilesToPresetFolder';
import { moveCore, onDidFailMoveFile, onDidMoveFile, onWillMoveFile } from './moveCore';
import { configureMoveDestinationAutoRevealExclude } from './autoRevealExclude';
import { getWorkspacePath, resolveWorkspacePath } from './pathUtils';
import { resolveNoteFilePath, sanitizeNoteTitle } from './dateNoteFile';
import { resolveMarkdownListFilePath, validateMarkdownListFileName } from './markdownListFile';

const markdownTableLinePattern = /^\s*\|.*\|\s*$/;

type TableAtCursor = {
	start: number;
	end: number;
	lines: string[];
	table: ReturnType<typeof parseMarkdownTable>;
};

function getTableAtCursor(editor: vscode.TextEditor): TableAtCursor | undefined {
	const cursorLine = editor.selection.active.line;
	const doc = editor.document;
	if (!markdownTableLinePattern.test(doc.lineAt(cursorLine).text)) {
		return undefined;
	}

	let start = cursorLine;
	let end = cursorLine;
	while (start > 0 && markdownTableLinePattern.test(doc.lineAt(start - 1).text)) { start--; }
	while (end < doc.lineCount - 1 && markdownTableLinePattern.test(doc.lineAt(end + 1).text)) { end++; }

	const lines: string[] = [];
	for (let i = start; i <= end; i++) { lines.push(doc.lineAt(i).text); }
	if (lines.length < 2) {
		return undefined;
	}

	const table = parseMarkdownTable(lines);
	if (table.header.length === 0 || !isMarkdownTableSeparator(table.separator)) {
		return undefined;
	}

	return { start, end, lines, table };
}

function shouldAutoFormatMarkdownTables(): boolean {
	return vscode.workspace.getConfiguration('vsmemo').get<boolean>('markdownTable.autoFormatAfterEdit', true);
}

async function replaceTable(
	editor: vscode.TextEditor,
	tableAtCursor: TableAtCursor,
	format = shouldAutoFormatMarkdownTables()
): Promise<boolean> {
	const newLines = stringifyMarkdownTable(tableAtCursor.table, format);
	const applied = await editor.edit(editBuilder => {
		const range = new vscode.Range(
			tableAtCursor.start,
			0,
			tableAtCursor.end,
			tableAtCursor.lines[tableAtCursor.lines.length - 1].length
		);
		editBuilder.replace(range, newLines.join('\n'));
	});
	if (!applied) {
		vscode.window.showErrorMessage('Failed to update Markdown table.');
	}
	return applied;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const history = new NoteHistory(context.workspaceState);
	const sidebarProvider = new SidebarProvider(history);
	const destinationProvider = new DestinationProvider();
	const noteView = vscode.window.createTreeView('vsmemoSidebarView', { treeDataProvider: sidebarProvider });
	const destinationView = vscode.window.createTreeView('vsmemoDestinationView', { treeDataProvider: destinationProvider });
	const updateEmptyMessage = () => {
		noteView.message = history.recentUris.length === 0 && history.pinnedUris.length === 0
			? '最近のメモはまだありません。見出しから作成または検索できます。'
			: undefined;
	};
	updateEmptyMessage();
	context.subscriptions.push(history.onDidChange(updateEmptyMessage));
	const revealNote = async (uri: vscode.Uri) => {
		if (!noteView.visible) { return; }
		const item = sidebarProvider.itemFor(uri);
		if (item) {
			try { await noteView.reveal(item, { select: true, focus: false, expand: false }); }
			catch { /* The view may not be visible while the editor changes. */ }
		}
	};
	let moveTarget = vscode.window.activeTextEditor?.document.uri;
	const updateTarget = (uri?: vscode.Uri) => {
		moveTarget = uri;
		destinationProvider.setTarget(uri);
		destinationView.message = destinationProvider.message;
	};
	updateTarget(moveTarget);
	context.subscriptions.push(history, sidebarProvider, destinationProvider, noteView, destinationView);
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		updateTarget(editor?.document.uri);
		if (editor && isMemoUri(editor.document.uri)) {
			void history.visit(editor.document.uri).then(() => revealNote(editor.document.uri));
		}
	}));
	if (vscode.window.activeTextEditor && isMemoUri(vscode.window.activeTextEditor.document.uri)) {
		const uri = vscode.window.activeTextEditor.document.uri;
		void history.visit(uri).then(() => revealNote(uri));
	}
	const moveHistory = new MoveHistoryTracker(history, async uri => {
		try { await vscode.workspace.fs.stat(uri); return true; }
		catch (error) { return !(error instanceof vscode.FileSystemError && error.code === 'FileNotFound'); }
	});
	context.subscriptions.push(onWillMoveFile(source => { moveHistory.begin(source); }));
	context.subscriptions.push(onDidMoveFile(({ source, target }) => {
		void moveHistory.complete(source, target);
		if (moveTarget?.toString() === source.toString()) { updateTarget(target); }
	}));
	context.subscriptions.push(onDidFailMoveFile(source => { void moveHistory.fail(source); }));
	context.subscriptions.push(vscode.workspace.onDidRenameFiles(event => {
		for (const file of event.files) { void history.move(file.oldUri, file.newUri); }
	}));
	const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
	context.subscriptions.push(watcher, watcher.onDidDelete(uri => { void moveHistory.deleted(uri); }));
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('vsmemo.moveDestinations') || event.affectsConfiguration('explorer.autoRevealExclude')) {
			destinationProvider.refresh();
		}
	}));
	context.subscriptions.push(
		vscode.commands.registerCommand('vsmemo.openNote', async (uri: vscode.Uri) => {
			try {
				await vscode.workspace.fs.stat(uri);
				await vscode.window.showTextDocument(uri);
			} catch (error) {
				if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
					await history.remove(uri);
					void vscode.window.showWarningMessage(`メモが見つかりません: ${path.basename(uri.fsPath)}`);
				} else {
					void vscode.window.showErrorMessage(`メモを開けません: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}),
		vscode.commands.registerCommand('vsmemo.togglePinNote', async (item?: NoteItem) => {
			const uri = item?.uri ?? moveTarget;
			if (uri && isMemoUri(uri)) { await history.togglePin(uri); }
		}),
		vscode.commands.registerCommand('vsmemo.findNote', async () => { await findNote(history); }),
		vscode.commands.registerCommand('vsmemo.showActions', async () => {
			await showMemoActions(history, editor => !!getTableAtCursor(editor));
		}),
		vscode.commands.registerCommand('vsmemo.moveToDestination', async (item?: DestinationItem) => {
			if (!(item instanceof DestinationItem) || !item.destinationKey) {
				void vscode.window.showWarningMessage('移動先を選択してください。');
				return;
			}
			const target = moveTarget;
			if (!target) { void vscode.window.showWarningMessage('移動対象のファイルを開いてください。'); return; }
			await moveCore({ context, selectedUri: target, fixedDestinationKey: item.destinationKey });
		}),
		vscode.commands.registerCommand('vsmemo.showMemoMore', async () => {
			const choice = await vscode.window.showQuickPick([
				{ label: 'VSMemoの操作', command: 'vsmemo.showActions' },
				{ label: '現在のメモを固定・解除', command: 'vsmemo.togglePinNote' },
				{ label: 'Markdownファイル一覧を作成', command: 'vsmemo.listMarkdownFilesInDir' },
				{ label: '移動先の自動Reveal除外設定', command: 'vsmemo.configureMoveDestinationAutoRevealExclude' },
				{ label: '移動先の履歴を消去', command: 'vsmemo.clearRecentDestinations' }
			], { placeHolder: 'メモのその他の操作' });
			if (choice) { await vscode.commands.executeCommand(choice.command); }
		}),
		vscode.commands.registerCommand('vsmemo.createDateNote', async (resource?: vscode.Uri) => {
			try {
				const contextResource = resource ?? vscode.window.activeTextEditor?.document.uri;
				const workspacePath = getWorkspacePath(contextResource);
				const config = vscode.workspace.getConfiguration('vsmemo', contextResource);
				const format = config.get<string>('fileNameFormat')!;
				let dirStat: fs.Stats | undefined;
				let dir: string;

				if (resource) {
					dir = resource.fsPath;
					dirStat = await fs.promises.stat(dir);
					if (!dirStat.isDirectory()) {
						vscode.window.showErrorMessage(`Failed to create note: ${dir} exists but is not a directory`);
						return;
					}
				} else {
					dir = resolveWorkspacePath(config.get<string>('createDirectory')!, workspacePath);
				}

				const now = new Date();
				const yyyy = formatDate(now, 'yyyy');
				const MM = formatDate(now, 'MM');
				const dd = formatDate(now, 'dd');
				const nameFor = (title: string) => format
					.replace(/\$\{yyyy\}/g, yyyy)
					.replace(/\$\{MM\}/g, MM)
					.replace(/\$\{dd\}/g, dd)
					.replace(/\$\{title\}/g, () => title)
					.replace(/\$\{ext\}/g, 'md');
				let previewStatus: vscode.Disposable | undefined;
				let userTitle: string | undefined;
				try {
					userTitle = await vscode.window.showInputBox({
						title: '日付メモの作成 — 1/2',
						prompt: `保存先: ${path.join(dir, nameFor('＜タイトル＞'))}`,
						validateInput: value => {
							previewStatus?.dispose();
							if (!value.trim()) { return 'Title is required'; }
							try {
								const filePath = resolveNoteFilePath(dir, nameFor(sanitizeNoteTitle(value)));
								previewStatus = vscode.window.setStatusBarMessage(`保存先: ${filePath}`);
								return undefined;
							} catch (error) { return error instanceof Error ? error.message : String(error); }
						}
					});
				} finally { previewStatus?.dispose(); }
				if (userTitle === undefined) { return; }
				if (!userTitle) {
					vscode.window.showErrorMessage('No title was entered');
					return;
				}

				if (!resource) {
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
				}

				const fileName = nameFor(sanitizeNoteTitle(userTitle));

				const filePath = resolveNoteFilePath(dir, fileName);
				const selectedTemplate = await selectDateNoteTemplate(config, workspacePath, filePath);
				if (!selectedTemplate) {
					return;
				}

				let content = '';
				if (selectedTemplate.kind === 'template' && selectedTemplate.templatePath) {
					content = await renderDateNoteTemplate(selectedTemplate.templatePath, {
						title: userTitle,
						yyyy,
						MM,
						dd,
						date: formatDate(now, config.get<string>('dateFormat', 'yyyy-MM-dd'))
					});
				}

				try {
					await fs.promises.writeFile(filePath, content, { flag: 'wx' });
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
						vscode.window.showErrorMessage(`Note already exists: ${fileName}`);
						return;
					}
					throw error;
				}
				const doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
			} catch (err: any) {
				if ((err as DateNoteTemplateError).alreadyShown) {
					return;
				}
				vscode.window.showErrorMessage(err.message === 'No workspace folder is open'
					? err.message : 'Failed to create note: ' + err.message);
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
			let tableLines = generateEmptyTable(rows, cols, withHeader === 'With header');
			if (shouldAutoFormatMarkdownTables()) {
				tableLines = stringifyMarkdownTable(parseMarkdownTable(tableLines));
			}
			const applied = await editor.edit(editBuilder => {
				const pos = editor.selection.active;
				editBuilder.insert(pos, tableLines.join('\n') + '\n');
			});
			if (!applied) {
				vscode.window.showErrorMessage('Failed to create Markdown table.');
			}
		}),
		vscode.commands.registerCommand('vsmemo.insertColumn', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const tableAtCursor = getTableAtCursor(editor);
			if (!tableAtCursor) { return; }
			const { lines, table } = tableAtCursor;
			// Determine cursor column position
			const cursorChar = editor.selection.active.character;
			const relLine = editor.selection.active.line - tableAtCursor.start;
			const lineText = lines[relLine];
			let colIdx = 0;
			const pipeIdxs = [...lineText.matchAll(/\|/g)].map(m => m.index!);
			for (let i = 0; i < pipeIdxs.length - 1; i++) {
				if (cursorChar >= pipeIdxs[i] && cursorChar < pipeIdxs[i + 1]) {
					colIdx = i;
					break;
				}
			}
			// If the cursor is at or after the last pipe in the line, the new column is added at the very end.
			if (cursorChar >= pipeIdxs[pipeIdxs.length - 1]) {
				colIdx = table.header.length;
			}
			table.header.splice(colIdx, 0, '');
			table.separator.splice(colIdx, 0, '---');
			table.rows = table.rows.map((row: string[]) => { row.splice(colIdx, 0, ''); return row; });
			await replaceTable(editor, tableAtCursor);
		}),
		vscode.commands.registerCommand('vsmemo.insertRow', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const tableAtCursor = getTableAtCursor(editor);
			if (!tableAtCursor) { return; }
			const table = tableAtCursor.table;
			// Determine the insertion index for the new row within table.rows.
			const relLine = editor.selection.active.line - tableAtCursor.start;
			let rowIdx: number; // The index in table.rows where the new row will be inserted.
			if (relLine <= 1) { rowIdx = 0; } // If cursor is on header/separator, insert new row after the separator (as the first data row).
			else if (relLine >= tableAtCursor.lines.length - 1) { rowIdx = table.rows.length; } // If cursor is on the last table line, append new row to the end.
			else { rowIdx = relLine - 1; }
			const colCount = table.header.length;
			table.rows.splice(rowIdx, 0, Array(colCount).fill(''));
			await replaceTable(editor, tableAtCursor);
		}),
		vscode.commands.registerCommand('vsmemo.convertSelectionToTable', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const delimiter = await vscode.window.showInputBox({ prompt: 'Enter delimiter (e.g., , or \\t)' });
			if (!delimiter) { return; }
			const sel = editor.selection;
			const text = editor.document.getText(sel);
			const lines = text.split('\n');
			const separatorText = delimiter === '\\t' ? '\t' : delimiter;
			const cells = lines.map(line => line.split(separatorText).map(cell => cell.trim()));
			const colCount = Math.max(...cells.map(arr => arr.length));
			const header = Array(colCount).fill(''); // empty header
			const separator = Array(colCount).fill('---');
			const body = cells.map(row => {
				const filled = Array(colCount).fill('');
				row.forEach((cell, i) => { filled[i] = cell; });
				return filled;
			});
			const tableLines = stringifyMarkdownTable({ header, separator, rows: body }, shouldAutoFormatMarkdownTables());
			const applied = await editor.edit(editBuilder => {
				editBuilder.replace(sel, tableLines.join('\n'));
			});
			if (!applied) {
				vscode.window.showErrorMessage('Failed to convert selection to Markdown table.');
			}
		}),
		vscode.commands.registerCommand('vsmemo.deleteColumn', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const tableAtCursor = getTableAtCursor(editor);
			if (!tableAtCursor) { return; }
			const { lines, table } = tableAtCursor;
			if (table.header.length <= 1) {
				vscode.window.showErrorMessage('Cannot delete the last column of a Markdown table.');
				return;
			}
			// カーソルの列位置を特定
			const cursorChar = editor.selection.active.character;
			const relLine = editor.selection.active.line - tableAtCursor.start;
			const lineText = lines[relLine];
			let colIdx = 0; // Determine the column index based on cursor position.
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
			await replaceTable(editor, tableAtCursor);
		}),
		vscode.commands.registerCommand('vsmemo.deleteRow', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const tableAtCursor = getTableAtCursor(editor);
			if (!tableAtCursor) { return; }
			const table = tableAtCursor.table;
			// Determine the index of the data row to delete based on cursor position.
			const relLine = editor.selection.active.line - tableAtCursor.start;
			// relLine mapping: 0 for header, 1 for separator, 2+ for data rows.
			if (relLine < 2) { return; }
			const rowIdx = relLine - 2;
			if (table.rows.length > 0 && rowIdx < table.rows.length) {
				table.rows.splice(rowIdx, 1);
				await replaceTable(editor, tableAtCursor);
			}
		}),
		vscode.commands.registerCommand('vsmemo.formatTableAtCursor', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const tableAtCursor = getTableAtCursor(editor);
			if (!tableAtCursor) {
				vscode.window.showInformationMessage('Cursor is not inside a Markdown table.');
				return;
			}
			await replaceTable(editor, tableAtCursor, true);
		}),
		vscode.commands.registerCommand('vsmemo.wrapCodeBlock', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const config = vscode.workspace.getConfiguration('vsmemo');
			const defaultLang = config.get<string>('defaultCodeBlockLanguage', 'mermaid');
			const language = await vscode.window.showInputBox({ prompt: 'Language for the code block', value: defaultLang });
			if (language === undefined) { return; }
			await wrapCodeBlock(editor, language || defaultLang);
		}),
		vscode.commands.registerCommand('vsmemo.insertTodayDate', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }
			const config = vscode.workspace.getConfiguration('vsmemo');
			const dateFormat = config.get<string>('dateFormat', 'yyyy-MM-dd');
			await insertTodayDate(editor, dateFormat);
		}),
		vscode.commands.registerCommand('vsmemo.listMarkdownFilesInDir', async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showErrorMessage('No active editor found.');
				return;
			}
			try {
				const filePath = editor.document.uri.fsPath;
				const dir = path.dirname(filePath);
				const files = await fs.promises.readdir(dir);
				const mdFiles = files.filter(f => f.toLowerCase().endsWith('.md'));
				if (mdFiles.length === 0) {
					vscode.window.showInformationMessage('No markdown files found in this directory.');
					return;
				}
				const outFileName = await vscode.window.showInputBox({
					prompt: 'Enter the output file name (with .md extension)',
					value: 'markdown_files_list.md',
					validateInput: validateMarkdownListFileName
				});
				if (!outFileName) {
					vscode.window.showErrorMessage('No file name was entered.');
					return;
				}
				const outFilePath = resolveMarkdownListFilePath(dir, outFileName);
				let existingOutput: fs.Stats | undefined;
				let existingEntry: fs.Stats | undefined;
				try {
					existingEntry = await fs.promises.lstat(outFilePath);
					if (!existingEntry.isFile() || existingEntry.isSymbolicLink()) {
						throw new Error('Output must be a regular file.');
					}
					existingOutput = await fs.promises.stat(outFilePath);
				} catch (err) {
					if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { throw err; }
				}
				if (existingOutput) {
					const answer = await vscode.window.showWarningMessage(
						`"${outFileName}" already exists. Overwrite it?`,
						{ modal: true }, 'Overwrite', 'Cancel'
					);
					if (answer !== 'Overwrite') { return; }
				}
				const sourceFiles: string[] = [];
				for (const file of mdFiles) {
					if (file === outFileName) { continue; }
					// Check identity for case variants so case-sensitive volumes keep distinct files.
					if (existingOutput && file.toLowerCase() === outFileName.toLowerCase()) {
						const candidate = await fs.promises.stat(path.join(dir, file));
						if (candidate.dev === existingOutput.dev && candidate.ino === existingOutput.ino) { continue; }
					}
					sourceFiles.push(file);
				}
				const content = sourceFiles.map(f => {
					const nameWithoutExt = f.replace(/\.md$/i, '');
					return `[${nameWithoutExt}](./${f})`;
				}).join('\n');
				if (existingEntry) {
					const latest = await fs.promises.lstat(outFilePath);
					if (!latest.isFile() || latest.isSymbolicLink() || latest.dev !== existingEntry.dev || latest.ino !== existingEntry.ino) {
						throw new Error('Output file changed after confirmation.');
					}
					const handle = await fs.promises.open(outFilePath, fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW || 0));
					try {
						const opened = await handle.stat();
						if (!opened.isFile() || opened.dev !== existingEntry.dev || opened.ino !== existingEntry.ino) {
							throw new Error('Output file changed after confirmation.');
						}
						await handle.truncate(0);
						await handle.writeFile(content, { encoding: 'utf-8' });
					} finally { await handle.close(); }
				} else {
					await fs.promises.writeFile(outFilePath, content, { encoding: 'utf-8', flag: 'wx' });
				}
				vscode.window.showInformationMessage(`Markdown file list saved to ${outFileName}`);
			} catch (err: any) {
				vscode.window.showErrorMessage('Failed to list markdown files: ' + err.message);
			}
		}),
		vscode.commands.registerCommand('vsmemo.moveFilesToPresetFolder', async (selectedUri?: vscode.Uri, allSelectedUris?: vscode.Uri[]) => {
			await moveFilesToPresetFolder(context, selectedUri, allSelectedUris);
		}),
		vscode.commands.registerCommand('vsmemo.quickMoveCurrentFile', async () => {
			await moveCore({ context });
		}),
		vscode.commands.registerCommand('vsmemo.archiveCurrentNote', async () => {
			const archiveKey = vscode.workspace.getConfiguration('vsmemo', vscode.window.activeTextEditor?.document.uri)
				.get<string | null>('archiveDestinationKey');
			if (!archiveKey) {
				vscode.window.showErrorMessage('Move cancelled. Archive destination is not configured.');
				return;
			}
			await moveCore({ context, fixedDestinationKey: archiveKey, archive: true });
		}),
		vscode.commands.registerCommand('vsmemo.clearRecentDestinations', async () => {
			await context.workspaceState.update('vsmemo.recentDestinations', undefined);
			vscode.window.showInformationMessage('Recent destinations history cleared.');
		}),
		vscode.commands.registerCommand('vsmemo.configureMoveDestinationAutoRevealExclude', async () => {
			await configureMoveDestinationAutoRevealExclude();
		}),
	);

}

// This method is called when your extension is deactivated
export function deactivate() { }
