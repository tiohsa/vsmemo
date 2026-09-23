import assert from 'assert';
import * as vscode from 'vscode';
import { NoteHistory } from '../noteHistory';
import { SidebarProvider } from '../sidebarProvider';

function state(): vscode.Memento {
	const values = new Map<string, unknown>();
	return {
		get: <T>(key: string, fallback?: T) => (values.get(key) as T | undefined) ?? fallback,
		update: async (key: string, value: unknown) => { values.set(key, value); },
		keys: () => [...values.keys()]
	};
}

suite('Memo history and sidebar', () => {
	test('recent notes are capped, pinned notes stay visible, and moves update both lists', async () => {
		const history = new NoteHistory(state());
		const source = vscode.Uri.file('/workspace/notes/note-0.md');
		const target = vscode.Uri.file('/workspace/archive/note-0.md');
		await history.visit(source);
		await history.togglePin(source);
		for (let index = 1; index <= 12; index++) {
			await history.visit(vscode.Uri.file(`/workspace/notes/note-${index}.md`));
		}
		assert.strictEqual(history.recentUris.length, 10);
		const provider = new SidebarProvider(history);
		const [pinnedGroup] = provider.getChildren();
		assert.strictEqual(provider.getChildren(pinnedGroup as never).length, 1);
		const pinnedItem = provider.itemFor(source);
		assert(pinnedItem);
		assert.strictEqual(provider.getParent(pinnedItem)?.id, 'vsmemo.notes.pinned');
		await history.move(source, target);
		assert(history.pinnedUris.includes(target.toString()));
		assert(!history.pinnedUris.includes(source.toString()));
		await history.remove(target);
		assert.strictEqual(provider.getChildren(pinnedGroup as never).length, 0);
		provider.dispose();
		history.dispose();
	});

	test('folder moves update descendant recent and pinned notes without matching sibling prefixes', async () => {
		const history = new NoteHistory(state());
		const project = vscode.Uri.file('/workspace/notes/project');
		const renamed = vscode.Uri.file('/workspace/notes/renamed');
		const child = vscode.Uri.file('/workspace/notes/project/docs/A.md');
		const sibling = vscode.Uri.file('/workspace/notes/project-backup/B.md');
		const renamedChild = vscode.Uri.file('/workspace/notes/renamed/docs/A.md');
		await history.visit(child);
		await history.visit(sibling);
		await history.togglePin(child);

		await history.move(project, renamed);

		assert(history.recentUris.includes(renamedChild.toString()));
		assert(history.pinnedUris.includes(renamedChild.toString()));
		assert(history.recentUris.includes(sibling.toString()));
		assert(history.pinnedUris.every(uri => uri !== child.toString()));
		history.dispose();
	});
});
