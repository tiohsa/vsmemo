import * as path from 'path';
import * as vscode from 'vscode';

const recentKey = 'vsmemo.recentNotes';
const pinnedKey = 'vsmemo.pinnedNotes';

export class NoteHistory {
	private recent: string[];
	private pinned: string[];
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChange = this.changed.event;

	constructor(private readonly state: vscode.Memento) {
		this.recent = state.get<string[]>(recentKey, []);
		this.pinned = state.get<string[]>(pinnedKey, []);
	}

	get recentUris(): readonly string[] { return this.recent; }
	get pinnedUris(): readonly string[] { return this.pinned; }
	isPinned(uri: vscode.Uri): boolean { return this.pinned.includes(uri.toString()); }

	async visit(uri: vscode.Uri): Promise<void> {
		if (uri.scheme !== 'file' || !uri.path.toLowerCase().endsWith('.md')) { return; }
		const key = uri.toString();
		this.recent = [key, ...this.recent.filter(item => item !== key)].slice(0, 10);
		await this.state.update(recentKey, this.recent);
		this.changed.fire();
	}

	async togglePin(uri: vscode.Uri): Promise<void> {
		const key = uri.toString();
		this.pinned = this.pinned.includes(key)
			? this.pinned.filter(item => item !== key)
			: [...this.pinned, key];
		await this.state.update(pinnedKey, this.pinned);
		this.changed.fire();
	}

	async move(source: vscode.Uri, target: vscode.Uri): Promise<void> {
		const from = source.toString();
		const sourcePath = path.resolve(source.fsPath);
		const targetPath = path.resolve(target.fsPath);
		const replace = (items: string[]) => [...new Set(items.map(item => {
			if (item === from) { return target.toString(); }
			try {
				const itemUri = vscode.Uri.parse(item);
				if (itemUri.scheme !== source.scheme) { return item; }
				const relative = path.relative(sourcePath, path.resolve(itemUri.fsPath));
				if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) { return item; }
				return vscode.Uri.file(path.join(targetPath, relative)).toString();
			} catch { return item; }
		}))];
		const recent = replace(this.recent);
		const pinned = replace(this.pinned);
		if (recent.every((item, index) => item === this.recent[index])
			&& pinned.every((item, index) => item === this.pinned[index])) { return; }
		this.recent = recent;
		this.pinned = pinned;
		await Promise.all([
			this.state.update(recentKey, this.recent),
			this.state.update(pinnedKey, this.pinned)
		]);
		this.changed.fire();
	}

	async remove(uri: vscode.Uri): Promise<void> {
		const key = uri.toString();
		this.recent = this.recent.filter(item => item !== key);
		this.pinned = this.pinned.filter(item => item !== key);
		await Promise.all([
			this.state.update(recentKey, this.recent),
			this.state.update(pinnedKey, this.pinned)
		]);
		this.changed.fire();
	}

	dispose(): void { this.changed.dispose(); }
}
