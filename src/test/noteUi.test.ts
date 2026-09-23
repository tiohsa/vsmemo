import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { NoteHistory } from '../noteHistory';
import { findNote } from '../noteUi';

interface Item extends vscode.QuickPickItem { uri: vscode.Uri; }

// Model the relevant Quick Pick behavior: resetting items focuses the first
// match, restoring activeItems ignores hidden items, and Enter accepts focus.
// These scenarios use literal queries; VS Code owns the full fuzzy matcher.
class SearchPicker {
	placeholder = '';
	matchOnDescription = false;
	matchOnDetail = false;
	keepScrollPosition = false;
	busy = false;
	value = '';
	scrollTop = 0;
	disposed = false;
	shown = false;
	snapshots: Item[][] = [];
	selectedItems: readonly Item[] = [];
	private currentItems: readonly Item[] = [];
	private active: readonly Item[] = [];
	private acceptListener = () => {};
	private hideListener = () => {};

	private matches(item: Item): boolean {
		return [item.label, this.matchOnDescription ? item.description : '', this.matchOnDetail ? item.detail : '']
			.some(text => text?.toLowerCase().includes(this.value.toLowerCase()));
	}
	get items() { return this.currentItems; }
	set items(items: readonly Item[]) {
		assert(!this.disposed, 'must not update a disposed picker');
		this.currentItems = items;
		this.snapshots.push(items.map(item => ({ ...item })));
		this.active = items.filter(item => this.matches(item)).slice(0, 1);
		if (!this.keepScrollPosition) { this.scrollTop = 0; }
	}
	get activeItems() { return this.active; }
	set activeItems(items: readonly Item[]) {
		assert(!this.disposed);
		this.active = items.filter(item => this.currentItems.includes(item) && this.matches(item));
	}
	type(value: string) {
		this.value = value;
		this.active = this.items.filter(item => this.matches(item)).slice(0, 1);
	}
	onDidAccept(listener: () => void) { this.acceptListener = listener; return { dispose() {} }; }
	onDidHide(listener: () => void) { this.hideListener = listener; return { dispose() {} }; }
	show() { this.shown = true; }
	dispose() { this.disposed = true; }
	hide() { this.hideListener(); }
	enter() { this.selectedItems = this.active; this.acceptListener(); }
}

suite('Memo search asynchronous updates', () => {
	let sandbox: sinon.SinonSandbox;
	let clock: sinon.SinonFakeTimers;
	let history: NoteHistory;
	let root: string;
	let picker: SearchPicker;
	let found: vscode.Uri[];
	let headings: Map<string, string>;
	let open: sinon.SinonStub;
	let stat: sinon.SinonStub;
	let showDocument: sinon.SinonStub;
	let beforeRead: (file: string) => Promise<void>;
	let searches: Promise<void>[];
	let pickers: SearchPicker[];
	let releases: (() => void)[];
	let sequence = 0;

	function notes(count: number, offset = 0): vscode.Uri[] {
		return Array.from({ length: count }, (_, index) =>
			vscode.Uri.file(path.join(root, `note-${String(index + offset).padStart(4, '0')}.md`)));
	}
	function deferred() {
		let release = () => {};
		const promise = new Promise<void>(resolve => { release = resolve; });
		releases.push(release);
		return { promise, release };
	}
	function start(uris = found) {
		found = uris;
		const search = findNote(history);
		searches.push(search);
		return search;
	}
	async function complete(uris = found) {
		const search = start(uris);
		await clock.tickAsync(0);
		assert.strictEqual(picker.busy, false, picker.placeholder);
		picker.hide();
		await search;
	}

	setup(() => {
		sandbox = sinon.createSandbox();
		clock = sandbox.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldClearNativeTimers: true });
		root = path.join(os.tmpdir(), `vsmemo-search-mock-${process.pid}-${sequence++}`);
		found = notes(24);
		headings = new Map(found.map(uri => [uri.fsPath, `# Heading ${path.basename(uri.fsPath)}`]));
		searches = [];
		pickers = [];
		releases = [];
		beforeRead = async () => {};
		history = new NoteHistory({ get: (_key: string, fallback: unknown) => fallback } as vscode.Memento);
		sandbox.stub(vscode.workspace, 'getConfiguration').returns({
			get: (key: string) => key === 'createDirectory' ? root : undefined
		} as vscode.WorkspaceConfiguration);
		sandbox.stub(vscode.window, 'createQuickPick').callsFake(() => {
			picker = new SearchPicker();
			pickers.push(picker);
			return picker as unknown as vscode.QuickPick<vscode.QuickPickItem>;
		});
		sandbox.stub(vscode.workspace, 'findFiles').callsFake(async () => {
			assert(picker.shown, 'search must show before file discovery');
			return found;
		});
		showDocument = sandbox.stub(vscode.window, 'showTextDocument').resolves();
		stat = sandbox.stub(fs.promises, 'stat').resolves({ mtimeMs: 1, size: 100 } as fs.Stats);
		open = sandbox.stub(fs.promises, 'open').callsFake(async file => ({
			read: async (buffer: Buffer) => {
				await beforeRead(String(file));
				const bytesRead = buffer.write(headings.get(String(file)) ?? 'No heading');
				return { bytesRead, buffer };
			},
			close: async () => {}
		} as fs.promises.FileHandle));
	});
	teardown(async () => {
		for (const item of pickers) { item.hide(); }
		for (const release of releases) { release(); }
		await clock.tickAsync(0);
		await Promise.all(searches);
		history.dispose();
		sandbox.restore();
	});

	test('preserves the selected URI, query and scroll through a timed refresh and Enter', async () => {
		const first = deferred();
		const rest = deferred();
		beforeRead = file => found.slice(0, 8).some(uri => uri.fsPath === file) ? first.promise : rest.promise;
		const search = start();
		await clock.tickAsync(0);
		assert.strictEqual(open.callCount, 8, 'only one batch should be in flight');
		assert.strictEqual(picker.items[5].label, 'note-0005');
		picker.type('note');
		picker.activeItems = [picker.items[5]];
		picker.scrollTop = 220;
		first.release();
		await clock.tickAsync(100);
		assert.strictEqual(picker.busy, true, 'refresh should happen before all reads finish');
		assert.strictEqual(picker.items[5].label, 'Heading note-0005.md');
		assert.strictEqual(picker.activeItems[0].uri.toString(), found[5].toString());
		assert.strictEqual(picker.value, 'note');
		assert.strictEqual(picker.scrollTop, 220);
		picker.enter();
		await search;
		assert.strictEqual(showDocument.firstCall.args[0].toString(), found[5].toString());
	});

	test('uses the latest query and selection when flushing pending headings', async () => {
		const rest = deferred();
		beforeRead = file => found.slice(8).some(uri => uri.fsPath === file) ? rest.promise : Promise.resolve();
		start();
		await clock.tickAsync(0);
		picker.type('note-000');
		picker.activeItems = [picker.items[5]];
		picker.type('note-001');
		picker.activeItems = [picker.items[12]];
		await clock.tickAsync(100);
		assert.strictEqual(picker.value, 'note-001');
		assert.strictEqual(picker.activeItems[0].uri.toString(), found[12].toString());
		rest.release();
		await clock.tickAsync(0);
		assert.strictEqual(picker.activeItems[0].uri.toString(), found[12].toString());
	});

	test('does not restore a previous selection hidden by the current query', async () => {
		const read = deferred();
		beforeRead = () => read.promise;
		const search = start();
		await clock.tickAsync(0);
		picker.activeItems = [picker.items[5]];
		picker.type('no matching note');
		read.release();
		await clock.tickAsync(0);
		assert.deepStrictEqual(picker.activeItems, []);
		assert.strictEqual(picker.value, 'no matching note');
		picker.enter();
		await search;
		assert(showDocument.notCalled);
	});

	test('coalesces fast batches and flushes the last headings without waiting for the timer', async () => {
		await complete();
		assert.strictEqual(picker.items.length, 24);
		assert.strictEqual(picker.snapshots.length, 2);
		assert(picker.items.every(item => item.label.startsWith('Heading')));
		await clock.tickAsync(100);
		assert.strictEqual(picker.snapshots.length, 2);
	});

	for (const unchanged of ['missing', 'same'] as const) {
		test(`does not reset 1,000 candidates when headings are ${unchanged}`, async () => {
			found = notes(1000);
			headings.clear();
			if (unchanged === 'same') {
				for (const uri of found) { headings.set(uri.fsPath, `# ${path.basename(uri.fsPath, '.md')}`); }
			}
			await complete();
			assert.strictEqual(picker.items.length, 1000, 'search must not truncate candidates');
			assert.strictEqual(picker.snapshots.length, 1);
		});
	}

	for (const pendingRefresh of [false, true]) {
		test(`cancel stops new batches and writes with pending refresh = ${pendingRefresh}`, async () => {
			const read = deferred();
			beforeRead = file => pendingRefresh && found.slice(0, 8).some(uri => uri.fsPath === file)
				? Promise.resolve() : read.promise;
			const search = start();
			await clock.tickAsync(0);
			const calls = open.callCount;
			assert.strictEqual(calls, pendingRefresh ? 16 : 8);
			picker.hide();
			await search;
			read.release();
			await clock.tickAsync(200);
			assert.strictEqual(open.callCount, calls);
			assert.strictEqual(picker.snapshots.length, 1);
			assert(showDocument.notCalled);
		});
	}

	test('reuses cached headings and invalidates them on mtime or size changes', async () => {
		found = notes(1);
		await complete();
		await complete();
		assert.strictEqual(open.callCount, 1);
		headings.set(found[0].fsPath, '# Updated heading');
		stat.resolves({ mtimeMs: 2, size: 100 } as fs.Stats);
		await complete();
		assert.strictEqual(open.callCount, 2);
		assert.strictEqual(picker.items[0].label, 'Updated heading');
		headings.set(found[0].fsPath, '# Size changed');
		stat.resolves({ mtimeMs: 2, size: 200 } as fs.Stats);
		await complete();
		assert.strictEqual(open.callCount, 3);
		assert.strictEqual(picker.items[0].label, 'Size changed');
	});

	test('evicts the least recently used heading after reaching capacity', async () => {
		const initial = notes(512);
		await complete(initial);
		assert.strictEqual(open.callCount, 512);
		await complete([initial[0]]);
		assert.strictEqual(open.callCount, 512);
		await complete(notes(1, 512));
		await complete([initial[0]]);
		assert.strictEqual(open.callCount, 513, 'recently used entry stays cached');
		await complete([initial[1]]);
		assert.strictEqual(open.callCount, 514, 'oldest entry must be read again');
	});

	test('removes a failed file from the cache', async () => {
		found = notes(1);
		await complete();
		stat.rejects(new Error('file removed'));
		await complete();
		assert.strictEqual(picker.items[0].label, 'note-0000');
		stat.resolves({ mtimeMs: 1, size: 100 } as fs.Stats);
		await complete();
		assert.strictEqual(open.callCount, 2);
	});
});
