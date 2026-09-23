import * as path from 'path';
import * as vscode from 'vscode';
import { NoteHistory } from './noteHistory';

export class NoteItem extends vscode.TreeItem {
	constructor(readonly uri: vscode.Uri, readonly pinned: boolean) {
		super(path.basename(uri.fsPath, '.md'), vscode.TreeItemCollapsibleState.None);
		this.id = uri.toString();
		this.description = vscode.workspace.asRelativePath(uri, false);
		this.tooltip = uri.fsPath;
		this.resourceUri = uri;
		this.iconPath = new vscode.ThemeIcon('file');
		this.contextValue = pinned ? 'vsmemoPinnedNote' : 'vsmemoNote';
		this.command = { command: 'vsmemo.openNote', title: 'メモを開く', arguments: [uri] };
	}
}

class NoteGroup extends vscode.TreeItem {
	constructor(readonly kind: 'pinned' | 'recent') {
		super(kind === 'pinned' ? '固定したメモ' : '最近のメモ', vscode.TreeItemCollapsibleState.Expanded);
		this.id = `vsmemo.notes.${kind}`;
		this.iconPath = new vscode.ThemeIcon(kind === 'pinned' ? 'pin' : 'history');
	}
}

export class SidebarProvider implements vscode.TreeDataProvider<NoteItem | NoteGroup> {
	private readonly changed = new vscode.EventEmitter<NoteItem | NoteGroup | undefined>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(private readonly history: NoteHistory) {
		history.onDidChange(() => this.changed.fire(undefined));
	}

	getTreeItem(item: NoteItem | NoteGroup): vscode.TreeItem { return item; }

	getParent(item: NoteItem | NoteGroup): NoteGroup | undefined {
		return item instanceof NoteItem ? new NoteGroup(item.pinned ? 'pinned' : 'recent') : undefined;
	}

	itemFor(uri: vscode.Uri): NoteItem | undefined {
		const key = uri.toString();
		if (this.history.pinnedUris.includes(key)) { return new NoteItem(uri, true); }
		if (this.history.recentUris.includes(key)) { return new NoteItem(uri, false); }
		return undefined;
	}

	getChildren(parent?: NoteGroup): (NoteItem | NoteGroup)[] {
		if (!parent) { return [new NoteGroup('pinned'), new NoteGroup('recent')]; }
		const pinned = parent.kind === 'pinned';
		const uris = pinned ? this.history.pinnedUris : this.history.recentUris.filter(uri => !this.history.pinnedUris.includes(uri));
		return uris.map(value => new NoteItem(vscode.Uri.parse(value), pinned));
	}

	dispose(): void { this.changed.dispose(); }
}
