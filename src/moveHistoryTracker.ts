import * as vscode from 'vscode';
import { NoteHistory } from './noteHistory';

/** Keeps watcher deletions from removing history during a VSMemo move. */
export class MoveHistoryTracker {
	private readonly pending = new Map<string, boolean>();

	constructor(
		private readonly history: NoteHistory,
		private readonly sourceExists: (uri: vscode.Uri) => Promise<boolean>
	) {}

	begin(source: vscode.Uri): void {
		this.pending.set(source.toString(), false);
	}

	async deleted(uri: vscode.Uri): Promise<void> {
		const key = uri.toString();
		if (this.pending.has(key)) {
			this.pending.set(key, true);
			return;
		}
		await this.history.remove(uri);
	}

	async complete(source: vscode.Uri, target: vscode.Uri): Promise<void> {
		this.pending.delete(source.toString());
		await this.history.move(source, target);
	}

	async fail(source: vscode.Uri): Promise<void> {
		const wasDeleted = this.pending.get(source.toString());
		this.pending.delete(source.toString());
		if (wasDeleted && !(await this.sourceExists(source))) {
			await this.history.remove(source);
		}
	}
}
