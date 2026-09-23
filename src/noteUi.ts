import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { loadMoveDestinations } from './moveDestinations';
import { NoteHistory } from './noteHistory';
import { getWorkspacePath, resolveWorkspacePath } from './pathUtils';

const headingCache = new Map<string, { mtimeMs: number; size: number; title?: string }>();

async function noteHeading(uri: vscode.Uri): Promise<string | undefined> {
	const key = uri.toString();
	try {
		const stat = await fs.promises.stat(uri.fsPath);
		const cached = headingCache.get(key);
		if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) { return cached.title; }
		const handle = await fs.promises.open(uri.fsPath, 'r');
		let title: string | undefined;
		try {
			const bytes = Buffer.alloc(4096);
			const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
			title = bytes.subarray(0, bytesRead).toString('utf8').match(/^#\s+(.+)$/m)?.[1].trim();
		} finally { await handle.close(); }
		headingCache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, title });
		return title;
	} catch {
		headingCache.delete(key);
		return undefined;
	}
}

export function memoRoots(resource?: vscode.Uri): string[] {
	const roots = new Set<string>();
	const workspacePath = getWorkspacePath(resource);
	try {
		const config = vscode.workspace.getConfiguration('vsmemo', resource);
		roots.add(resolveWorkspacePath(config.get<string>('createDirectory')!, workspacePath));
	} catch { /* A configured destination may still be usable. */ }
	try {
		for (const destination of loadMoveDestinations(resource, workspacePath)) { roots.add(destination.resolvedPath); }
	} catch { /* Search the available note root when destinations are incomplete. */ }
	return [...roots];
}

export function isMemoUri(uri: vscode.Uri): boolean {
	if (uri.scheme !== 'file' || !uri.path.toLowerCase().endsWith('.md')) { return false; }
	return memoRoots(uri).some(root => {
		const relative = path.relative(root, uri.fsPath);
		return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
	});
}

export async function findNote(history: NoteHistory): Promise<void> {
	const roots = memoRoots(vscode.window.activeTextEditor?.document.uri);
	if (roots.length === 0) {
		void vscode.window.showInformationMessage('検索できるメモの保存先がありません。');
		return;
	}
	const selected = await new Promise<NoteQuickPickItem | undefined>(resolve => {
		const picker = vscode.window.createQuickPick<NoteQuickPickItem>();
		const cancellation = new vscode.CancellationTokenSource();
		let finished = false;
		picker.placeholder = 'メモを検索（見出し・ファイル名・パス）';
		picker.matchOnDescription = true;
		picker.matchOnDetail = true;
		picker.busy = true;
		const finish = (item?: NoteQuickPickItem) => {
			if (finished) { return; }
			finished = true;
			cancellation.cancel();
			cancellation.dispose();
			picker.dispose();
			resolve(item);
		};
		picker.onDidAccept(() => finish(picker.selectedItems[0]));
		picker.onDidHide(() => finish());
		picker.show();
		void (async () => {
			try {
				const found = await Promise.all(roots.map(root =>
					vscode.workspace.findFiles(
						new vscode.RelativePattern(vscode.Uri.file(root), '**/*.md'),
						undefined,
						undefined,
						cancellation.token
					)
				));
				if (finished) { return; }
				const byKey = new Map<string, vscode.Uri>();
				for (const uri of found.flat()) { byKey.set(uri.toString(), uri); }
				const priority = [...history.pinnedUris, ...history.recentUris];
				const sorted = [...byKey.values()].sort((a, b) => {
					const aRank = priority.indexOf(a.toString());
					const bRank = priority.indexOf(b.toString());
					if (aRank !== bRank) { return (aRank < 0 ? Infinity : aRank) - (bRank < 0 ? Infinity : bRank); }
					return a.fsPath.localeCompare(b.fsPath);
				});
				const items: NoteQuickPickItem[] = sorted.map(uri => ({
					label: path.basename(uri.fsPath, path.extname(uri.fsPath)),
					description: vscode.workspace.asRelativePath(uri, false),
					detail: path.basename(uri.fsPath),
					uri
				}));
				picker.items = items;
				if (items.length === 0) { picker.placeholder = 'メモが見つかりません'; }
				for (let start = 0; start < items.length && !finished; start += 8) {
					const batch = items.slice(start, start + 8);
					const headings = await Promise.all(batch.map(item => noteHeading(item.uri)));
					if (finished) { return; }
					for (let index = 0; index < batch.length; index++) {
						if (headings[index]) { batch[index].label = headings[index]!; }
					}
					picker.items = [...items];
				}
				picker.busy = false;
			} catch {
				if (!finished) {
					picker.busy = false;
					picker.placeholder = 'メモを検索できませんでした';
				}
			}
		})();
	});
	if (selected) { await vscode.window.showTextDocument(selected.uri); }
}

export async function canEditText(editor: vscode.TextEditor): Promise<boolean> {
	const uri = editor.document.uri;
	if (uri.scheme === 'untitled') { return true; }
	if (uri.scheme !== 'file' || vscode.workspace.fs.isWritableFileSystem?.(uri.scheme) === false) { return false; }
	try {
		const stat = await vscode.workspace.fs.stat(uri);
		return (stat.permissions ?? 0) & vscode.FilePermission.Readonly ? false : true;
	} catch { return false; }
}

interface Action extends vscode.QuickPickItem { command: string; }
interface NoteQuickPickItem extends vscode.QuickPickItem { uri: vscode.Uri; }

export async function showMemoActions(history: NoteHistory, inTable: (editor: vscode.TextEditor) => boolean): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		const choice = await vscode.window.showQuickPick([
			{ label: '日付メモを作成', command: 'vsmemo.createDateNote' },
			{ label: 'メモを探す', command: 'vsmemo.findNote' }
		], { placeHolder: 'VSMemoの操作' });
		if (choice) { await vscode.commands.executeCommand(choice.command); }
		return;
	}
	const uri = editor.document.uri;
	const documentVersion = editor.document.version;
	const selection = editor.selection;
	const editable = await canEditText(editor);
	const canMoveFile = uri.scheme === 'file';
	const items: Action[] = [];
	if (editable) {
		if (inTable(editor)) {
			items.push(
				{ label: '表を整形', description: path.basename(uri.fsPath), command: 'vsmemo.formatTableAtCursor' },
				{ label: '行を追加', command: 'vsmemo.insertRow' },
				{ label: '列を追加', command: 'vsmemo.insertColumn' },
				{ label: '行を削除', command: 'vsmemo.deleteRow' },
				{ label: '列を削除', command: 'vsmemo.deleteColumn' }
			);
		} else {
			items.push(
				{ label: '今日の日付を挿入', command: 'vsmemo.insertTodayDate' },
				{ label: '表を作成', command: 'vsmemo.createTableAtPosition' }
			);
		}
		if (!editor.selection.isEmpty) {
			items.push(
				{ label: 'コードブロックで囲む', command: 'vsmemo.wrapCodeBlock' },
				{ label: '選択範囲を表へ変換', command: 'vsmemo.convertSelectionToTable' }
			);
		}
	}
	if (canMoveFile) {
		items.push(
			{ label: '移動先を選んで移動', description: path.basename(uri.fsPath), command: 'vsmemo.quickMoveCurrentFile' },
			{ label: 'アーカイブへ移動', description: path.basename(uri.fsPath), command: 'vsmemo.archiveCurrentNote' }
		);
	}
	items.push({ label: 'メモを探す', command: 'vsmemo.findNote' });
	const selected = await vscode.window.showQuickPick(items, { placeHolder: `${path.basename(uri.fsPath)} の操作` });
	if (!selected) { return; }
	if (selected.command === 'vsmemo.findNote') { await findNote(history); return; }
	const isFileMove = selected.command === 'vsmemo.quickMoveCurrentFile' || selected.command === 'vsmemo.archiveCurrentNote';
	if (isFileMove) {
		if (!canMoveFile || vscode.window.activeTextEditor !== editor
			|| editor.document.uri.toString() !== uri.toString()) {
			void vscode.window.showWarningMessage('操作対象が変わりました。もう一度選んでください。');
			return;
		}
		await vscode.commands.executeCommand(selected.command);
		return;
	}
	const stillWritable = await canEditText(editor);
	if (!stillWritable || vscode.window.activeTextEditor !== editor
		|| editor.document.uri.toString() !== uri.toString()
		|| editor.document.version !== documentVersion
		|| !editor.selection.isEqual(selection)) {
		void vscode.window.showWarningMessage('操作対象または編集可否が変わりました。もう一度選んでください。');
		return;
	}
	await vscode.commands.executeCommand(selected.command);
}
