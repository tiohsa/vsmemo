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
		if (!this.recent.includes(from) && !this.pinned.includes(from)) { return; }
		const to = target.toString();
		const replace = (items: string[]) => [...new Set(items.map(item => item === from ? to : item))];
		this.recent = replace(this.recent);
		this.pinned = replace(this.pinned);
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
