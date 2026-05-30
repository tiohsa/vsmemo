import assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';
import { activate } from '../extension';

// --- Global Indirection Wrappers ---
let currentShowErrorMessageSpy: any;
let currentShowWarningMessageSpy: any;
let currentShowInformationMessageSpy: any;
let currentShowInputBoxStub: any;
let currentShowQuickPickStub: any;
let currentGetConfigurationStub: any;
let currentWorkspaceFoldersStub: any;
let currentFsStatStub: any;
let currentFsRenameStub: any;
let currentFsCreateDirectoryStub: any;
let currentFsReadDirectoryStub: any;
let currentFsReadFileStub: any;
let currentFsWriteFileStub: any;
let currentTextDocumentsStub: any;
let currentActiveTextEditorStub: any;

let nodeFsStatMap = new Map<string, any>();
let nodeFsMkdirMap = new Map<string, any>();
let nodeFsReaddirMap = new Map<string, any>();
let nodeFsReadFileMap = new Map<string, any>();
let nodeFsWriteFileMap = new Map<string, any>();

let statStub: any;
let mkdirStub: any;
let readdirStub: any;
let readFileStub: any;
let writeFileStub: any;

let fsStatStub: any;
let fsRenameStub: any;
let fsCreateDirectoryStub: any;
let fsReadDirectoryStub: any;
let fsReadFileStub: any;
let fsWriteFileStub: any;

let fsStatMap = new Map<string, any>();
let fsRenameMap = new Map<string, any>();
let fsCreateDirectoryMap = new Map<string, any>();
let fsReadDirectoryMap = new Map<string, any>();
let fsReadFileMap = new Map<string, any>();
let fsWriteFileMap = new Map<string, any>();

// Wrap node fs promises with endsWith Map matching and sinon assert hooks
Object.defineProperty(fs.promises, 'stat', {
	value: async (p: string) => {
		if (statStub) {
			const res = await statStub(p);
			if (res !== undefined) { return res; }
		}
		const key = p.replace(/\\/g, '/');
		for (const [k, v] of nodeFsStatMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		return { isDirectory: () => true, isFile: () => false } as fs.Stats;
	},
	writable: true,
	configurable: true
});
Object.defineProperty(fs.promises, 'mkdir', {
	value: async (p: string, options?: any) => {
		if (mkdirStub) {
			const res = await mkdirStub(p, options);
			if (res !== undefined) { return res; }
		}
		const key = p.replace(/\\/g, '/');
		for (const [k, v] of nodeFsMkdirMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return;
			}
		}
		return;
	},
	writable: true,
	configurable: true
});
Object.defineProperty(fs.promises, 'readdir', {
	value: async (p: string) => {
		if (readdirStub) {
			const res = await readdirStub(p);
			if (res !== undefined) { return res; }
		}
		const key = p.replace(/\\/g, '/');
		for (const [k, v] of nodeFsReaddirMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		return [];
	},
	writable: true,
	configurable: true
});
Object.defineProperty(fs.promises, 'readFile', {
	value: async (p: string) => {
		if (readFileStub) {
			const res = await readFileStub(p);
			if (res !== undefined) { return res; }
		}
		const key = p.replace(/\\/g, '/');
		for (const [k, v] of nodeFsReadFileMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		throw new Error('File not found');
	},
	writable: true,
	configurable: true
});
Object.defineProperty(fs.promises, 'writeFile', {
	value: async (p: string, content: string) => {
		if (writeFileStub) {
			const res = await writeFileStub(p, content);
			if (res !== undefined) { return res; }
		}
		const key = p.replace(/\\/g, '/');
		for (const [k, v] of nodeFsWriteFileMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return;
			}
		}
		return;
	},
	writable: true,
	configurable: true
});

// Wrap vscode window APIs
Object.defineProperty(vscode.window, 'showErrorMessage', {
	value: (...args: any[]) => currentShowErrorMessageSpy ? currentShowErrorMessageSpy(...args) : Promise.resolve(undefined),
	writable: true,
	configurable: true
});
Object.defineProperty(vscode.window, 'showWarningMessage', {
	value: (...args: any[]) => currentShowWarningMessageSpy ? currentShowWarningMessageSpy(...args) : Promise.resolve(undefined),
	writable: true,
	configurable: true
});
Object.defineProperty(vscode.window, 'showInformationMessage', {
	value: (...args: any[]) => currentShowInformationMessageSpy ? currentShowInformationMessageSpy(...args) : Promise.resolve(undefined),
	writable: true,
	configurable: true
});
Object.defineProperty(vscode.window, 'showInputBox', {
	value: (...args: any[]) => currentShowInputBoxStub ? currentShowInputBoxStub(...args) : Promise.resolve(undefined),
	writable: true,
	configurable: true
});
Object.defineProperty(vscode.window, 'showQuickPick', {
	value: (...args: any[]) => currentShowQuickPickStub ? currentShowQuickPickStub(...args) : Promise.resolve(undefined),
	writable: true,
	configurable: true
});
Object.defineProperty(vscode.workspace, 'getConfiguration', {
	value: (...args: any[]) => currentGetConfigurationStub ? currentGetConfigurationStub(...args) : undefined,
	writable: true,
	configurable: true
});

const mockFs = {
	stat: async (...args: any[]) => {
		if (fsStatStub) {
			const res = await fsStatStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsStatMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		throw vscode.FileSystemError.FileNotFound();
	},
	rename: async (...args: any[]) => {
		if (fsRenameStub) {
			const res = await fsRenameStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/') + '->' + args[1].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsRenameMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return;
			}
		}
		return;
	},
	createDirectory: async (...args: any[]) => {
		if (fsCreateDirectoryStub) {
			const res = await fsCreateDirectoryStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsCreateDirectoryMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return;
			}
		}
		return;
	},
	readDirectory: async (...args: any[]) => {
		if (fsReadDirectoryStub) {
			const res = await fsReadDirectoryStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsReadDirectoryMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		return [];
	},
	readFile: async (...args: any[]) => {
		if (fsReadFileStub) {
			const res = await fsReadFileStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsReadFileMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return v;
			}
		}
		throw vscode.FileSystemError.FileNotFound();
	},
	writeFile: async (...args: any[]) => {
		if (fsWriteFileStub) {
			const res = await fsWriteFileStub(...args);
			if (res !== undefined) { return res; }
		}
		const key = args[0].fsPath.replace(/\\/g, '/');
		for (const [k, v] of fsWriteFileMap.entries()) {
			if (key.endsWith(k)) {
				if (v instanceof Error) { throw v; }
				return;
			}
		}
		return;
	}
};

Object.defineProperty(vscode.workspace, 'fs', {
	get: () => mockFs,
	configurable: true
});

Object.defineProperty(vscode.workspace, 'workspaceFolders', {
	get: () => currentWorkspaceFoldersStub ? currentWorkspaceFoldersStub() : undefined,
	configurable: true
});

Object.defineProperty(vscode.workspace, 'textDocuments', {
	get: () => currentTextDocumentsStub ? currentTextDocumentsStub() : [],
	configurable: true
});

Object.defineProperty(vscode.window, 'activeTextEditor', {
	get: () => currentActiveTextEditorStub ? currentActiveTextEditorStub() : undefined,
	configurable: true
});

const sharedWorkspaceState = {
	data: {} as Record<string, any>,
	get: (key: string, defaultValue?: any) => sharedWorkspaceState.data[key] ?? defaultValue,
	update: async (key: string, value: any) => { sharedWorkspaceState.data[key] = value; },
	keys: () => Object.keys(sharedWorkspaceState.data)
};

const sharedGlobalState = {
	data: {} as Record<string, any>,
	get: (key: string, defaultValue?: any) => sharedGlobalState.data[key] ?? defaultValue,
	update: async (key: string, value: any) => { sharedGlobalState.data[key] = value; },
	keys: () => Object.keys(sharedGlobalState.data),
	setKeysForSync: () => {}
};

const sharedMockContext = {
	subscriptions: [],
	workspaceState: sharedWorkspaceState,
	globalState: sharedGlobalState,
	extensionPath: path.sep + path.join('mock', 'extension', 'path'),
	storagePath: path.sep + path.join('mock', 'storage', 'path'),
	globalStoragePath: path.sep + path.join('mock', 'global', 'storage', 'path'),
	logPath: path.sep + path.join('mock', 'log', 'path'),
	asAbsolutePath: (relativePath: string) => path.join(path.sep + 'mock', 'extension', 'path', relativePath),
	extensionUri: vscode.Uri.file(path.sep + path.join('mock', 'extension', 'path')),
	environmentVariableCollection: {},
	extensionMode: vscode.ExtensionMode.Test,
	storageUri: vscode.Uri.file(path.sep + path.join('mock', 'storage', 'path')),
	globalStorageUri: vscode.Uri.file(path.sep + path.join('mock', 'global', 'storage', 'path')),
	logUri: vscode.Uri.file(path.sep + path.join('mock', 'log', 'path')),
	secrets: { get: () => undefined, store: async () => {}, delete: async () => {}, onDidChange: () => ({ dispose: () => {} }) },
} as unknown as vscode.ExtensionContext;

let activated = false;
function ensureActivated(context: vscode.ExtensionContext) {
	if (!activated) {
		activate(context);
		activated = true;
	}
}

suite('Extension Test Suite - vsmemo.createDateNote', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let sandbox: sinon.SinonSandbox;
	let mockContext: vscode.ExtensionContext;
	let showErrorMessageSpy: sinon.SinonSpy;
	let showInputBoxStub: sinon.SinonStub;
	let showQuickPickStub: sinon.SinonStub;
	let getConfigurationStub: sinon.SinonStub;
	let workspaceFoldersGetterStub: sinon.SinonStub; // For stubbing the getter of workspace.workspaceFolders
	let openTextDocumentStub: sinon.SinonStub;
	let showTextDocumentStub: sinon.SinonStub;
	const defaultTemplateDir = path.sep + path.join('test', 'workspace', '.vsmemo', 'templates');

	const mockWorkspaceFolder = {
		uri: vscode.Uri.file(path.sep + path.join('test', 'workspace')), // Use path.sep for platform-agnostic paths
		name: 'test-workspace',
		index: 0
	};

	function createVsmemoConfig(values: Record<string, unknown> = {}): vscode.WorkspaceConfiguration {
		const defaults: Record<string, unknown> = {
			createDirectory: path.sep + path.join('test', 'notes'),
			fileNameFormat: '${yyyy}-${MM}-${dd}-${title}.${ext}',
			dateFormat: 'yyyy-MM-dd',
			dateNoteTemplateDirectory: '${workspaceFolder}/.vsmemo/templates',
			dateNoteTemplateRequired: false
		};

		return {
			get: (key: string, defaultValue?: unknown) => values[key] ?? defaults[key] ?? defaultValue,
			has: sinon.stub().returns(true),
			inspect: sinon.stub(),
			update: sinon.stub()
		} as unknown as vscode.WorkspaceConfiguration;
	}

	setup(() => {
		sandbox = sinon.createSandbox();

		// Initialize shared state for each test
		sharedWorkspaceState.data = {};
		sharedGlobalState.data = {};

		showErrorMessageSpy = sandbox.spy();
		currentShowErrorMessageSpy = showErrorMessageSpy;

		showInputBoxStub = sandbox.stub();
		currentShowInputBoxStub = showInputBoxStub;

		showQuickPickStub = sandbox.stub();
		currentShowQuickPickStub = showQuickPickStub;
		showQuickPickStub.callsFake(async (items: readonly vscode.QuickPickItem[]) => items[0]);

		getConfigurationStub = sandbox.stub();
		currentGetConfigurationStub = getConfigurationStub;
		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig());

		workspaceFoldersGetterStub = sandbox.stub().returns([mockWorkspaceFolder]);
		currentWorkspaceFoldersStub = workspaceFoldersGetterStub;

		// Setup maps for Node.js fs stubs
		nodeFsStatMap = new Map();
		nodeFsMkdirMap = new Map();
		nodeFsReaddirMap = new Map();
		nodeFsReadFileMap = new Map();
		nodeFsWriteFileMap = new Map();

		// Default maps for createDateNote
		nodeFsStatMap.set('notes_exist', { isDirectory: () => true, isFile: () => false });
		nodeFsStatMap.set('selected-folder', { isDirectory: () => true, isFile: () => false });
		nodeFsStatMap.set('notes_in_ws', { isDirectory: () => true, isFile: () => false });
		nodeFsStatMap.set('notes', { isDirectory: () => true, isFile: () => false });
		nodeFsStatMap.set('notes_is_file', { isDirectory: () => false, isFile: () => true });
		nodeFsStatMap.set('selected-file.md', { isDirectory: () => false, isFile: () => true });

		const eNoent = new Error('ENOENT');
		(eNoent as any).code = 'ENOENT';
		nodeFsStatMap.set('notes_stat_fail', eNoent);
		nodeFsStatMap.set('notes_stat_fail_mkdir_ok', eNoent);

		nodeFsReaddirMap.set('.vsmemo/templates', ['meeting.md', 'ignore.txt', 'daily.md']);
		nodeFsReaddirMap.set('templates', ['meeting.md', 'ignore.txt', 'daily.md']);

		nodeFsReadFileMap.set('daily.md', '# ${title}\n${yyyy}-${MM}-${dd}\n${date}\n${unknown}\n${title}');

		// Sinon stubs for assertions spy
		statStub = sandbox.stub();
		mkdirStub = sandbox.stub();
		readdirStub = sandbox.stub();
		readFileStub = sandbox.stub();
		writeFileStub = sandbox.stub();

		// Assign actual implementations for stub verification
		nodeFsStatMap.set('dummy_stat_assert', statStub);
		nodeFsMkdirMap.set('dummy_mkdir_assert', mkdirStub);
		nodeFsReaddirMap.set('dummy_readdir_assert', readdirStub);
		nodeFsReadFileMap.set('dummy_readfile_assert', readFileStub);
		nodeFsWriteFileMap.set('dummy_writefile_assert', writeFileStub);

		openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
		showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');

		// Activate the extension to register commands once.
		ensureActivated(sharedMockContext);
	});

	teardown(() => {
		sandbox.restore();
		currentShowErrorMessageSpy = undefined;
		currentShowWarningMessageSpy = undefined;
		currentShowInformationMessageSpy = undefined;
		currentShowInputBoxStub = undefined;
		currentShowQuickPickStub = undefined;
		currentGetConfigurationStub = undefined;
		currentWorkspaceFoldersStub = undefined;
		currentFsStatStub = undefined;
		currentFsRenameStub = undefined;
		currentFsCreateDirectoryStub = undefined;
		currentFsReadDirectoryStub = undefined;
		currentFsReadFileStub = undefined;
		currentFsWriteFileStub = undefined;
		currentTextDocumentsStub = undefined;
		currentActiveTextEditorStub = undefined;

		nodeFsStatMap.clear();
		nodeFsMkdirMap.clear();
		nodeFsReaddirMap.clear();
		nodeFsReadFileMap.clear();
		nodeFsWriteFileMap.clear();

		sharedWorkspaceState.data = {};
		sharedGlobalState.data = {};
	});

	async function executeCreateDateNoteCommand(resource?: vscode.Uri) {
		// The command is registered in `setup` by calling `activate`.
		await vscode.commands.executeCommand('vsmemo.createDateNote', resource);
	}

	test('Should create a note successfully in a specified directory (new directory)', async () => {
		const testDir = path.sep + path.join('test', 'notes');
		const testTitle = 'My Test Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		statStub.withArgs(testDir).rejects({ code: 'ENOENT' }); // Directory does not exist
		mkdirStub.withArgs(testDir, { recursive: true }).resolves(undefined);
		writeFileStub.withArgs(expectedFilePath, '').resolves(undefined);
		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should check directory once');
		assert(mkdirStub.calledOnceWith(testDir, { recursive: true }), 'fs.mkdir should create directory');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file with correct path and empty content');
		assert(openTextDocumentStub.calledOnceWith(expectedFilePath), 'openTextDocument should be called with correct path');
		assert(showTextDocumentStub.calledOnceWith(mockDoc), 'showTextDocument should be called with the new document');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should create a note in the selected Explorer folder when resource is provided', async () => {
		const selectedDir = path.sep + path.join('test', 'selected-folder');
		const selectedUri = vscode.Uri.file(selectedDir);
		const testTitle = 'Explorer Folder Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(selectedDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		statStub.withArgs(selectedDir).resolves({ isDirectory: () => true } as fs.Stats);
		writeFileStub.withArgs(expectedFilePath, '').resolves(undefined);
		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand(selectedUri);

		assert(statStub.calledOnceWith(selectedDir), 'fs.stat should check the selected Explorer folder');
		assert(mkdirStub.notCalled, 'fs.mkdir should not be called for an existing selected Explorer folder');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file in selected Explorer folder');
		assert(openTextDocumentStub.calledOnceWith(expectedFilePath), 'openTextDocument should be called with selected folder file path');
		assert(showTextDocumentStub.calledOnceWith(mockDoc), 'showTextDocument should be called with the new document');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should show error when selected Explorer resource is not a directory', async () => {
		const selectedFile = path.sep + path.join('test', 'selected-file.md');
		const selectedUri = vscode.Uri.file(selectedFile);

		statStub.withArgs(selectedFile).resolves({ isDirectory: () => false, isFile: () => true } as fs.Stats);

		await executeCreateDateNoteCommand(selectedUri);

		assert(statStub.calledOnceWith(selectedFile), 'fs.stat should check the selected Explorer resource');
		assert(showInputBoxStub.notCalled, 'showInputBox should not be called for non-directory resources');
		assert(mkdirStub.notCalled, 'fs.mkdir should not be called');
		assert(writeFileStub.notCalled, 'fs.writeFile should not be called');
		assert(showErrorMessageSpy.calledOnceWith(`Failed to create note: ${selectedFile} exists but is not a directory`),
			'Error message for selected file instead of directory');
	});

	test('Should use workspaceFolder when ${workspaceFolder} is in createDirectory', async () => {
		const workspacePath = mockWorkspaceFolder.uri.fsPath;
		const relativeDir = 'notes_in_ws';
		const configuredDir = `\${workspaceFolder}${path.sep}${relativeDir}`;
		const expectedDir = path.join(workspacePath, relativeDir);
		const testTitle = 'Workspace Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(expectedDir, expectedFileName);

		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: configuredDir }));

		showInputBoxStub.resolves(testTitle);
		statStub.withArgs(expectedDir).rejects({ code: 'ENOENT' });
		mkdirStub.withArgs(expectedDir, { recursive: true }).resolves(undefined);
		writeFileStub.withArgs(expectedFilePath, '').resolves(undefined);

		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(workspaceFoldersGetterStub.called, "workspace.workspaceFolders getter should have been called");
		assert(statStub.calledOnceWith(expectedDir), 'fs.stat should check resolved workspace directory once');
		assert(mkdirStub.calledOnceWith(expectedDir, { recursive: true }), 'fs.mkdir should create directory in workspace');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file in workspace');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should show error if ${workspaceFolder} is used and no workspace is open', async () => {
		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: `\${workspaceFolder}${path.sep}notes` }));
		// workspaceFoldersGetterStubはgetter stubなので、値を直接セット
		workspaceFoldersGetterStub.returns(undefined); // No workspace folders

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnceWith('No workspace folder is open'), 'Error for no workspace folder');
		assert(statStub.notCalled, 'fs.stat should not be called');
	});

	test('Should show error if user does not enter a title', async () => {
		showInputBoxStub.resolves(undefined); // User cancels

		await executeCreateDateNoteCommand();

		assert(showInputBoxStub.calledOnce, 'showInputBox should be called');
		assert(showErrorMessageSpy.calledOnceWith('No title was entered'), 'Error for no title');
		assert(writeFileStub.notCalled, 'fs.writeFile should not be called');
	});

	test('Should handle existing directory without calling mkdir', async () => {
		const testDir = path.sep + path.join('test', 'notes_exist');
		const testTitle = 'Existing Dir Note';
		const now = new Date();
		// Get the format from the stubbed configuration for this test
		const currentConfig = vscode.workspace.getConfiguration('vsmemo');
		const fileNameFormat = currentConfig.get<string>('fileNameFormat')!;
		const expectedFileName = fileNameFormat
			.replace(/\$\{yyyy\}/g, formatDate(now, 'yyyy'))
			.replace(/\$\{MM\}/g, formatDate(now, 'MM'))
			.replace(/\$\{dd\}/g, formatDate(now, 'dd'))
			.replace(/\$\{title\}/g, testTitle)
			.replace(/\$\{ext\}/g, 'md');
		const expectedFilePath = path.join(testDir, expectedFileName);

		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: testDir }));

		showInputBoxStub.resolves(testTitle);
		statStub.withArgs(testDir).resolves({ isDirectory: () => true } as fs.Stats); // Directory exists

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should check directory');
		assert(mkdirStub.notCalled, 'fs.mkdir should not be called');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file in existing directory');
	});

	test('Should show error from mkdir if stat fails (non-ENOENT) and mkdir also fails', async () => {
		const testDir = path.sep + path.join('test', 'notes_stat_fail');
		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: testDir }));
		showInputBoxStub.resolves("Test Title");
		const statError = new Error('Permission denied for stat');
		(statError as any).code = 'EACCES';
		nodeFsStatMap.set('notes_stat_fail', statError);

		const mkdirError = new Error('Permission denied for mkdir');
		nodeFsMkdirMap.set('notes_stat_fail', mkdirError);

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnceWith('Failed to create note: ' + mkdirError.message), 'Error message from mkdir failure');
	});

	test('Should create note if stat fails (non-ENOENT) but mkdir succeeds', async () => {
		const testDir = path.sep + path.join('test', 'notes_stat_fail_mkdir_ok');
		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: testDir }));
		const testTitle = 'StatFail MkdirOk Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		const statError = new Error('Permission denied for stat');
		(statError as any).code = 'EACCES'; // Non-ENOENT error
		nodeFsStatMap.set('notes_stat_fail_mkdir_ok', statError);

		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(openTextDocumentStub.calledOnceWith(expectedFilePath), 'openTextDocument should be called');
		assert(showTextDocumentStub.calledOnceWith(mockDoc), 'showTextDocument should be called');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should show error if fs.promises.writeFile fails', async () => {
		const testDir = path.sep + path.join('test', 'notes'); // Using default from setup
		const testTitle = 'Write Fail Note';
		const now = new Date();
		const currentConfig = vscode.workspace.getConfiguration('vsmemo');
		const fileNameFormat = currentConfig.get<string>('fileNameFormat')!;
		const expectedFileName = fileNameFormat
			.replace(/\$\{yyyy\}/g, formatDate(now, 'yyyy'))
			.replace(/\$\{MM\}/g, formatDate(now, 'MM'))
			.replace(/\$\{dd\}/g, formatDate(now, 'dd'))
			.replace(/\$\{title\}/g, testTitle)
			.replace(/\$\{ext\}/g, 'md');
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		nodeFsWriteFileMap.set('Write Fail Note.md', new Error('writeFile failed'));

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnceWith('Failed to create note: writeFile failed'));
	});

	test('Should handle directory already existing as a file', async () => {
		const testDir = path.sep + path.join('test', 'notes_is_file');
		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ createDirectory: testDir }));
		showInputBoxStub.resolves("Test Title");
		nodeFsStatMap.set('notes_is_file', { isDirectory: () => false, isFile: () => true });

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnceWith(`Failed to create note: ${testDir} exists but is not a directory`),
			'Error message for existing file instead of directory');
	});

	test('Should offer Blank note when default template directory does not exist and templates are optional', async () => {
		const testDir = path.sep + path.join('test', 'notes');
		const testTitle = 'Optional Template Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		const eNoentReaddir = new Error('ENOENT');
		(eNoentReaddir as any).code = 'ENOENT';
		readdirStub.rejects(eNoentReaddir);

		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		const quickPickItems = showQuickPickStub.firstCall.args[0] as vscode.QuickPickItem[];
		assert.deepStrictEqual(quickPickItems.map(item => item.label), ['Blank note']);
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should render the selected date note template', async () => {
		const testDir = path.sep + path.join('test', 'notes');
		const testTitle = 'Rendered Template Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);
		const dailyTemplatePath = path.join(defaultTemplateDir, 'daily.md');
		const template = '# ${title}\n${yyyy}-${MM}-${dd}\n${date}\n${unknown}\n${title}';
		const expectedContent = `# ${testTitle}\n${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}\n${formatDate(now, 'yyyy/MM/dd')}\n\${unknown}\n${testTitle}`;

		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ dateFormat: 'yyyy/MM/dd' }));
		showInputBoxStub.resolves(testTitle);
		nodeFsReaddirMap.set('templates', ['meeting.md', 'ignore.txt', 'daily.md']);
		showQuickPickStub.callsFake(async (items: readonly vscode.QuickPickItem[]) => {
			return items.find(item => item.label === 'daily');
		});
		nodeFsReadFileMap.set('daily.md', template);
		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		const quickPickItems = showQuickPickStub.firstCall.args[0] as vscode.QuickPickItem[];
		assert.deepStrictEqual(quickPickItems.map(item => item.label), ['Blank note', 'daily', 'meeting']);
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should not create a note when template QuickPick is canceled', async () => {
		const testDir = path.sep + path.join('test', 'notes');

		showInputBoxStub.resolves('Canceled Template Note');
		showQuickPickStub.resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(openTextDocumentStub.notCalled, 'openTextDocument should not be called');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should show error and not create a note when required template directory is missing', async () => {
		const testDir = path.sep + path.join('test', 'notes');

		getConfigurationStub.withArgs('vsmemo').returns(createVsmemoConfig({ dateNoteTemplateRequired: true }));
		showInputBoxStub.resolves('Required Template Note');

		const eNoentReaddir = new Error('ENOENT');
		(eNoentReaddir as any).code = 'ENOENT';
		readdirStub.rejects(eNoentReaddir);

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnce);
		assert(showErrorMessageSpy.firstCall.args[0].includes('template directory not found'));
		assert(showQuickPickStub.notCalled, 'showQuickPick should not be called');
	});

	test('Should show error and not create a note when selected template cannot be read', async () => {
		const testDir = path.sep + path.join('test', 'notes');
		const templatePath = path.join(defaultTemplateDir, 'daily.md');

		showInputBoxStub.resolves('Unreadable Template Note');
		nodeFsReaddirMap.set('templates', ['daily.md']);
		showQuickPickStub.callsFake(async (items: readonly vscode.QuickPickItem[]) => {
			return items.find(item => item.label === 'daily');
		});
		nodeFsReadFileMap.set('daily.md', new Error('permission denied'));

		await executeCreateDateNoteCommand();

		assert(showErrorMessageSpy.calledOnce);
		assert(showErrorMessageSpy.firstCall.args[0].includes('failed to read template'));
	});

	test('Should create an empty note when Blank note is selected', async () => {
		const testDir = path.sep + path.join('test', 'notes');
		const testTitle = 'Explicit Blank Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		nodeFsReaddirMap.set('templates', ['daily.md']);
		showQuickPickStub.callsFake(async (items: readonly vscode.QuickPickItem[]) => {
			return items.find(item => item.label === 'Blank note');
		});
		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(readFileStub.notCalled, 'template file should not be read');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create an empty note');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});
});

suite('Extension Test Suite - vsmemo.moveFilesToPresetFolder', () => {
	let sandbox: sinon.SinonSandbox;
	let showErrorMessageSpy: sinon.SinonSpy;
	let showWarningMessageSpy: sinon.SinonStub;
	let showInformationMessageSpy: sinon.SinonSpy;
	let showQuickPickStub: sinon.SinonStub;
	let getConfigurationStub: sinon.SinonStub;
	let workspaceFoldersGetterStub: sinon.SinonStub;
	const mockWorkspaceFolder = {
		uri: vscode.Uri.file('/mock/workspace'),
		name: 'mock-workspace',
		index: 0
	};

	setup(() => {
		sandbox = sinon.createSandbox();

		showErrorMessageSpy = sandbox.spy();
		currentShowErrorMessageSpy = showErrorMessageSpy;

		showWarningMessageSpy = sandbox.stub().resolves(undefined);
		currentShowWarningMessageSpy = showWarningMessageSpy;

		showInformationMessageSpy = sandbox.spy();
		currentShowInformationMessageSpy = showInformationMessageSpy;

		showQuickPickStub = sandbox.stub();
		currentShowQuickPickStub = showQuickPickStub;

		getConfigurationStub = sandbox.stub();
		currentGetConfigurationStub = getConfigurationStub;

		workspaceFoldersGetterStub = sandbox.stub().returns([mockWorkspaceFolder]);
		currentWorkspaceFoldersStub = workspaceFoldersGetterStub;

		fsStatStub = sandbox.stub();
		currentFsStatStub = fsStatStub;

		fsRenameStub = sandbox.stub();
		currentFsRenameStub = fsRenameStub;

		fsCreateDirectoryStub = sandbox.stub();
		currentFsCreateDirectoryStub = fsCreateDirectoryStub;

		fsStatMap = new Map();
		fsRenameMap = new Map();
		fsCreateDirectoryMap = new Map();

		fsStatStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsStatMap.has(key)) {
				const val = fsStatMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			throw vscode.FileSystemError.FileNotFound();
		});

		fsRenameStub.callsFake(async (source: vscode.Uri, target: vscode.Uri) => {
			const key = source.fsPath.replace(/\\/g, '/') + '->' + target.fsPath.replace(/\\/g, '/');
			if (fsRenameMap.has(key)) {
				const val = fsRenameMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			return;
		});

		fsCreateDirectoryStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsCreateDirectoryMap.has(key)) {
				const val = fsCreateDirectoryMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			return;
		});

		ensureActivated(sharedMockContext);
	});

	teardown(() => {
		sandbox.restore();
		currentShowErrorMessageSpy = undefined;
		currentShowWarningMessageSpy = undefined;
		currentShowInformationMessageSpy = undefined;
		currentShowInputBoxStub = undefined;
		currentShowQuickPickStub = undefined;
		currentGetConfigurationStub = undefined;
		currentWorkspaceFoldersStub = undefined;
		currentFsStatStub = undefined;
		currentFsRenameStub = undefined;
		currentFsCreateDirectoryStub = undefined;
		currentFsReadDirectoryStub = undefined;
		currentFsReadFileStub = undefined;
		currentFsWriteFileStub = undefined;
		currentTextDocumentsStub = undefined;
		currentActiveTextEditorStub = undefined;
	});

	function setMoveDestinationsConfig(destinations: any) {
		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return destinations; }
				return defaultValue;
			},
			has: () => true,
			inspect: () => undefined,
			update: () => Promise.resolve()
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.returns(config);
	}

	test('TC-01: Move one selected file successfully', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		const targetUri = vscode.Uri.file('/mock/workspace/archive/source.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(targetUri.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(fsCreateDirectoryStub.calledOnce);
		assert(fsRenameStub.calledOnce);
		assert(showInformationMessageSpy.calledOnceWith('Moved 1 file to "Archive".'));
	});

	test('TC-02: Move multiple selected files successfully', async () => {
		const sourceUri1 = vscode.Uri.file('/mock/workspace/source1.md');
		const sourceUri2 = vscode.Uri.file('/mock/workspace/source2.md');
		const targetUri1 = vscode.Uri.file('/mock/workspace/archive/source1.md');
		const targetUri2 = vscode.Uri.file('/mock/workspace/archive/source2.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(sourceUri2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(targetUri1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(targetUri2.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });
		showWarningMessageSpy.resolves('Move Files'); // Bypass multiple files confirmation

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri1, [sourceUri1, sourceUri2]);

		assert(fsCreateDirectoryStub.calledOnce);
		assert(fsRenameStub.calledTwice);
		assert(showInformationMessageSpy.calledOnceWith('Moved 2 files to "Archive".'));
	});

	test('TC-03: Cancel QuickPick causes no side effects', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		showQuickPickStub.resolves(undefined);

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(fsCreateDirectoryStub.notCalled);
		assert(fsRenameStub.notCalled);
	});

	test('TC-04: Destination setting is missing', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig(undefined);

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('No preset move destinations are configured.'));
	});

	test('TC-05: Destination setting is empty', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig({});

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('No preset move destinations are configured.'));
	});

	test('TC-06: Destination path is empty', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig({ 'Archive': '' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Invalid configuration: Destination path for "Archive" cannot be empty.'));
	});

	test('TC-07: Destination path is invalid (not a string)', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig({ 'Archive': 123 });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Invalid configuration: Destination path for "Archive" must be a string.'));
	});

	test('TC-08: Selected resource includes a folder', async () => {
		const sourceUri1 = vscode.Uri.file('/mock/workspace/source1.md');
		const sourceFolderUri = vscode.Uri.file('/mock/workspace/folder');

		fsStatMap.set(sourceUri1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(sourceFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri1, [sourceUri1, sourceFolderUri]);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Folders are not supported.'));
	});

	test('TC-11: ${workspaceFolder} used without workspace', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });
		workspaceFoldersGetterStub.returns(undefined); // No workspace folder

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. No workspace folder is open.'));
	});

	test('TC-13: Destination exists as a file', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		showQuickPickStub.resolves({ label: 'Archive' });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Destination path is a file, not a folder: /mock/workspace/archive'));
		assert(fsRenameStub.notCalled);
	});

	test('TC-15: Filename conflict exists', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		const targetUri = vscode.Uri.file('/mock/workspace/archive/source.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(targetUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		showQuickPickStub.resolves({ label: 'Archive' });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Destination already contains: source.md'));
		assert(fsRenameStub.notCalled);
	});

	test('TC-16: One conflict in multiple files cancels the entire operation', async () => {
		const sourceUri1 = vscode.Uri.file('/mock/workspace/source1.md');
		const sourceUri2 = vscode.Uri.file('/mock/workspace/source2.md');
		const targetUri1 = vscode.Uri.file('/mock/workspace/archive/source1.md');
		const targetUri2 = vscode.Uri.file('/mock/workspace/archive/source2.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(sourceUri2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(targetUri1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(targetUri2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		showQuickPickStub.resolves({ label: 'Archive' });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri1, [sourceUri1, sourceUri2]);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Destination already contains: source2.md'));
		assert(fsRenameStub.notCalled);
	});

	test('TC-17: Source and destination are the same', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/archive/source.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });

		showQuickPickStub.resolves({ label: 'Archive' });

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Source and destination are the same.'));
		assert(fsRenameStub.notCalled);
	});

	test('TC-18: Second file fails during move (partial failure is reported)', async () => {
		const sourceUri1 = vscode.Uri.file('/mock/workspace/source1.md');
		const sourceUri2 = vscode.Uri.file('/mock/workspace/source2.md');
		const targetUri1 = vscode.Uri.file('/mock/workspace/archive/source1.md');
		const targetUri2 = vscode.Uri.file('/mock/workspace/archive/source2.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(sourceUri2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(targetUri1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(targetUri2.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });
		showWarningMessageSpy.resolves('Move Files'); // Bypass multiple files confirmation

		fsRenameMap.set(sourceUri1.fsPath.replace(/\\/g, '/') + '->' + targetUri1.fsPath.replace(/\\/g, '/'), undefined);
		fsRenameMap.set(sourceUri2.fsPath.replace(/\\/g, '/') + '->' + targetUri2.fsPath.replace(/\\/g, '/'), new Error('Permission denied'));

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri1, [sourceUri1, sourceUri2]);

		assert(showWarningMessageSpy.calledTwice);
		assert(showWarningMessageSpy.secondCall.calledWith('Move partially failed. 1 succeeded, 1 failed.'));
	});

	test('TC-19: All moves fail during execution', async () => {
		const sourceUri = vscode.Uri.file('/mock/workspace/source.md');
		const targetUri = vscode.Uri.file('/mock/workspace/archive/source.md');
		const destFolderUri = vscode.Uri.file('/mock/workspace/archive');

		setMoveDestinationsConfig({ 'Archive': '${workspaceFolder}/archive' });

		fsStatMap.set(sourceUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolderUri.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(targetUri.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });

		fsRenameMap.set(sourceUri.fsPath.replace(/\\/g, '/') + '->' + targetUri.fsPath.replace(/\\/g, '/'), new Error('Permission denied'));

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', sourceUri);

		assert(showErrorMessageSpy.calledOnceWith('Move failed. No files were moved.'));
	});
});

suite('Extension Test Suite - File Organization Suite (High-Priority)', () => {
	let sandbox: sinon.SinonSandbox;
	let showErrorMessageSpy: sinon.SinonSpy;
	let showWarningMessageSpy: sinon.SinonStub;
	let showInformationMessageSpy: sinon.SinonSpy;
	let showQuickPickStub: sinon.SinonStub;
	let getConfigurationStub: sinon.SinonStub;
	let workspaceFoldersGetterStub: sinon.SinonStub;
	let textDocumentsStub: sinon.SinonStub;
	let activeTextEditorStub: sinon.SinonStub;

	const mockWorkspaceFolder = {
		uri: vscode.Uri.file('/mock/workspace'),
		name: 'mock-workspace',
		index: 0
	};

	setup(() => {
		sandbox = sinon.createSandbox();

		showErrorMessageSpy = sandbox.spy();
		currentShowErrorMessageSpy = showErrorMessageSpy;

		showWarningMessageSpy = sandbox.stub().resolves(undefined);
		currentShowWarningMessageSpy = showWarningMessageSpy;

		showInformationMessageSpy = sandbox.spy();
		currentShowInformationMessageSpy = showInformationMessageSpy;

		showQuickPickStub = sandbox.stub();
		currentShowQuickPickStub = showQuickPickStub;

		getConfigurationStub = sandbox.stub();
		currentGetConfigurationStub = getConfigurationStub;

		workspaceFoldersGetterStub = sandbox.stub().returns([mockWorkspaceFolder]);
		currentWorkspaceFoldersStub = workspaceFoldersGetterStub;

		fsStatStub = sandbox.stub();
		currentFsStatStub = fsStatStub;

		fsRenameStub = sandbox.stub();
		currentFsRenameStub = fsRenameStub;

		fsCreateDirectoryStub = sandbox.stub();
		currentFsCreateDirectoryStub = fsCreateDirectoryStub;

		fsReadDirectoryStub = sandbox.stub();
		currentFsReadDirectoryStub = fsReadDirectoryStub;

		fsReadFileStub = sandbox.stub();
		currentFsReadFileStub = fsReadFileStub;

		fsWriteFileStub = sandbox.stub();
		currentFsWriteFileStub = fsWriteFileStub;

		textDocumentsStub = sandbox.stub().returns([]);
		currentTextDocumentsStub = textDocumentsStub;

		activeTextEditorStub = sandbox.stub().returns(undefined);
		currentActiveTextEditorStub = activeTextEditorStub;

		fsStatMap = new Map();
		fsRenameMap = new Map();
		fsCreateDirectoryMap = new Map();
		fsReadDirectoryMap = new Map();
		fsReadFileMap = new Map();
		fsWriteFileMap = new Map();

		fsStatStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsStatMap.has(key)) {
				const val = fsStatMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			throw vscode.FileSystemError.FileNotFound();
		});

		fsRenameStub.callsFake(async (source: vscode.Uri, target: vscode.Uri) => {
			const key = source.fsPath.replace(/\\/g, '/') + '->' + target.fsPath.replace(/\\/g, '/');
			if (fsRenameMap.has(key)) {
				const val = fsRenameMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			return;
		});

		fsCreateDirectoryStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsCreateDirectoryMap.has(key)) {
				const val = fsCreateDirectoryMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			return;
		});

		fsReadDirectoryStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsReadDirectoryMap.has(key)) {
				const val = fsReadDirectoryMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			return [];
		});

		fsReadFileStub.callsFake(async (uri: vscode.Uri) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsReadFileMap.has(key)) {
				const val = fsReadFileMap.get(key);
				if (val instanceof Error) { throw val; }
				return val;
			}
			throw vscode.FileSystemError.FileNotFound();
		});

		fsWriteFileStub.callsFake(async (uri: vscode.Uri, content: Uint8Array) => {
			const key = uri.fsPath.replace(/\\/g, '/');
			if (fsWriteFileMap.has(key)) {
				const val = fsWriteFileMap.get(key);
				if (val instanceof Error) { throw val; }
				return;
			}
			return;
		});

		ensureActivated(sharedMockContext);
	});

	teardown(() => {
		sandbox.restore();
		currentShowErrorMessageSpy = undefined;
		currentShowWarningMessageSpy = undefined;
		currentShowInformationMessageSpy = undefined;
		currentShowInputBoxStub = undefined;
		currentShowQuickPickStub = undefined;
		currentGetConfigurationStub = undefined;
		currentWorkspaceFoldersStub = undefined;
		currentFsStatStub = undefined;
		currentFsRenameStub = undefined;
		currentFsCreateDirectoryStub = undefined;
		currentFsReadDirectoryStub = undefined;
		currentFsReadFileStub = undefined;
		currentFsWriteFileStub = undefined;
		currentTextDocumentsStub = undefined;
		currentActiveTextEditorStub = undefined;
	});

	test('T-01: Move Confirmation is shown after successful preflight checks', async () => {
		const source1 = vscode.Uri.file('/mock/workspace/file1.md');
		const source2 = vscode.Uri.file('/mock/workspace/file2.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target1 = vscode.Uri.file('/mock/workspace/archive/file1.md');
		const target2 = vscode.Uri.file('/mock/workspace/archive/file2.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'moveConfirmation.enabled') { return true; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(source2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(target1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(target2.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });
		showWarningMessageSpy.resolves('Move Files'); // User confirms

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source1, [source1, source2]);

		assert(showWarningMessageSpy.calledOnce);
		const warningArgs = showWarningMessageSpy.firstCall.args;
		assert(warningArgs[0].includes('Are you sure you want to move 2 files to "Archive"?'));
		assert(warningArgs[0].includes('file1.md'));
		assert(warningArgs[0].includes('file2.md'));
		assert.deepStrictEqual(warningArgs[1], { modal: true });
		assert.strictEqual(warningArgs[2], 'Move Files');
	});

	test('T-02: File operations are not performed when confirmation is cancelled', async () => {
		const source1 = vscode.Uri.file('/mock/workspace/file1.md');
		const source2 = vscode.Uri.file('/mock/workspace/file2.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target1 = vscode.Uri.file('/mock/workspace/archive/file1.md');
		const target2 = vscode.Uri.file('/mock/workspace/archive/file2.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'moveConfirmation.enabled') { return true; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(source2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(target1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(target2.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });
		showWarningMessageSpy.resolves(undefined); // User cancels

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source1, [source1, source2]);

		assert(showWarningMessageSpy.calledOnce);
		assert(fsCreateDirectoryStub.notCalled);
		assert(fsRenameStub.notCalled);
	});

	test('T-03: Quick Move rejects untitled files', async () => {
		const source = vscode.Uri.file('/mock/workspace/Untitled-1');
		activeTextEditorStub.returns({ document: { uri: source } });

		await vscode.commands.executeCommand('vsmemo.quickMoveCurrentFile');

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Untitled files cannot be moved.'));
		assert(fsRenameStub.notCalled);
	});

	test('T-04: Move is cancelled when saving a dirty file is cancelled', async () => {
		const source = vscode.Uri.file('/mock/workspace/dirty.md');
		const docMock = {
			uri: source,
			isDirty: true,
			isUntitled: false,
			save: sandbox.stub().resolves(false)
		};
		textDocumentsStub.returns([docMock]);
		activeTextEditorStub.returns({ document: { uri: source } });

		showWarningMessageSpy.resolves('Cancel'); // User cancels save

		await vscode.commands.executeCommand('vsmemo.quickMoveCurrentFile');

		assert(showWarningMessageSpy.calledOnce);
		assert(docMock.save.notCalled);
		assert(fsRenameStub.notCalled);
	});

	test('T-05: No duplicates are created in Recent Destinations', async () => {
		const source = vscode.Uri.file('/mock/workspace/file.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target = vscode.Uri.file('/mock/workspace/archive/file.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive', 'Trash': '${workspaceFolder}/trash' }; }
				if (key === 'recentDestinations.enabled') { return true; }
				if (key === 'recentDestinations.maxItems') { return 5; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(target.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });

		const mockWorkspaceState = sharedMockContext.workspaceState;
		await mockWorkspaceState.update('vsmemo.recentDestinations', ['Trash', 'Archive']);

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source);

		const updated = mockWorkspaceState.get<string[]>('vsmemo.recentDestinations');
		assert.deepStrictEqual(updated, ['Archive', 'Trash']);
	});

	test('T-06: Removed destination keys are excluded from recent destinations list', async () => {
		const source = vscode.Uri.file('/mock/workspace/file.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'recentDestinations.enabled') { return true; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		const mockWorkspaceState = sharedMockContext.workspaceState;
		await mockWorkspaceState.update('vsmemo.recentDestinations', ['OldDest', 'Archive']);

		showQuickPickStub.resolves(undefined); // cancel to verify list

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source);

		assert(showQuickPickStub.calledOnce);
		const quickPickItems = showQuickPickStub.firstCall.args[0] as vscode.QuickPickItem[];
		const labels = quickPickItems.map(item => item.label);
		assert(!labels.includes('OldDest'));
		assert(labels.includes('Archive'));
	});

	test('T-07: Archive command errors when archive key is not set', async () => {
		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'archiveDestinationKey') { return null; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		await vscode.commands.executeCommand('vsmemo.archiveCurrentNote');

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Archive destination is not configured.'));
	});

	test('T-08: Archive command errors when archive key is missing from destinations', async () => {
		const source = vscode.Uri.file('/mock/workspace/note.md');
		activeTextEditorStub.returns({ document: { uri: source } });

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'archiveDestinationKey') { return 'MissingKey'; }
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		await vscode.commands.executeCommand('vsmemo.archiveCurrentNote');

		assert(showErrorMessageSpy.calledOnceWith('Move cancelled. Archive destination key "MissingKey" does not exist.'));
	});

	test('T-09: Auto Index updates only managed section without breaking existing user content', async () => {
		const source = vscode.Uri.file('/mock/workspace/file1.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target = vscode.Uri.file('/mock/workspace/archive/file1.md');
		const indexFile = vscode.Uri.file('/mock/workspace/archive/index.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'autoIndexUpdate.enabled') { return true; }
				if (key === 'autoIndexUpdate.fileName') { return 'index.md'; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(target.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(indexFile.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		showQuickPickStub.resolves({ label: 'Archive' });

		fsReadDirectoryMap.set(destFolder.fsPath.replace(/\\/g, '/'), [
			['file1.md', vscode.FileType.File],
			['index.md', vscode.FileType.File]
		]);

		const existingContent = '# Project Index\n\nSome user notes here.\n\n<!-- VSMemo Index Start -->\n- [old](./old.md)\n<!-- VSMemo Index End -->\n\nMore user notes.';
		const existingBytes = new TextEncoder().encode(existingContent);
		fsReadFileMap.set(indexFile.fsPath.replace(/\\/g, '/'), existingBytes);

		let writtenContent = '';
		fsWriteFileStub.callsFake(async (uri: vscode.Uri, content: Uint8Array) => {
			if (uri.fsPath === indexFile.fsPath) {
				writtenContent = new TextDecoder('utf-8').decode(content);
			}
		});

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source);

		assert(fsWriteFileStub.calledOnce);
		assert(writtenContent.startsWith('# Project Index\n\nSome user notes here.'));
		assert(writtenContent.endsWith('\n\nMore user notes.'));
		assert(writtenContent.includes('<!-- VSMemo Index Start -->\n- [file1](./file1.md)\n<!-- VSMemo Index End -->'));
	});

	test('T-10: Auto Index update failure does not roll back successfully moved files', async () => {
		const source = vscode.Uri.file('/mock/workspace/file1.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target = vscode.Uri.file('/mock/workspace/archive/file1.md');
		const indexFile = vscode.Uri.file('/mock/workspace/archive/index.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'autoIndexUpdate.enabled') { return true; }
				if (key === 'autoIndexUpdate.fileName') { return 'index.md'; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(target.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(indexFile.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });

		showQuickPickStub.resolves({ label: 'Archive' });

		fsReadDirectoryMap.set(destFolder.fsPath.replace(/\\/g, '/'), [
			['file1.md', vscode.FileType.File],
			['index.md', vscode.FileType.File]
		]);

		fsWriteFileMap.set(indexFile.fsPath.replace(/\\/g, '/'), new Error('Disk write failure'));

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source);

		assert(fsRenameStub.calledOnce);
		assert(showWarningMessageSpy.calledOnce);
		assert(showWarningMessageSpy.firstCall.args[0].includes('Auto Index Update failed'));
		assert(showInformationMessageSpy.calledOnceWith('Moved 1 file to "Archive".'));
	});

	test('T-11: Only successfully moved files are added to the auto index on partial success', async () => {
		const source1 = vscode.Uri.file('/mock/workspace/file1.md');
		const source2 = vscode.Uri.file('/mock/workspace/file2.md');
		const destFolder = vscode.Uri.file('/mock/workspace/archive');
		const target1 = vscode.Uri.file('/mock/workspace/archive/file1.md');
		const target2 = vscode.Uri.file('/mock/workspace/archive/file2.md');
		const indexFile = vscode.Uri.file('/mock/workspace/archive/index.md');

		const config = {
			get: (key: string, defaultValue?: any) => {
				if (key === 'moveDestinations') { return { 'Archive': '${workspaceFolder}/archive' }; }
				if (key === 'autoIndexUpdate.enabled') { return true; }
				if (key === 'autoIndexUpdate.fileName') { return 'index.md'; }
				return defaultValue;
			}
		} as unknown as vscode.WorkspaceConfiguration;
		getConfigurationStub.withArgs('vsmemo').returns(config);

		fsStatMap.set(source1.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(source2.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.File });
		fsStatMap.set(destFolder.fsPath.replace(/\\/g, '/'), { type: vscode.FileType.Directory });
		fsStatMap.set(target1.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(target2.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());
		fsStatMap.set(indexFile.fsPath.replace(/\\/g, '/'), vscode.FileSystemError.FileNotFound());

		showQuickPickStub.resolves({ label: 'Archive' });
		showWarningMessageSpy.resolves('Move Files'); // Bypass multiple files confirmation

		fsRenameMap.set(source1.fsPath.replace(/\\/g, '/') + '->' + target1.fsPath.replace(/\\/g, '/'), undefined);
		fsRenameMap.set(source2.fsPath.replace(/\\/g, '/') + '->' + target2.fsPath.replace(/\\/g, '/'), new Error('Rename permission denied'));

		fsReadDirectoryMap.set(destFolder.fsPath.replace(/\\/g, '/'), [
			['file1.md', vscode.FileType.File],
		]);

		let writtenContent = '';
		fsWriteFileStub.callsFake(async (uri: vscode.Uri, content: Uint8Array) => {
			if (uri.fsPath === indexFile.fsPath) {
				writtenContent = new TextDecoder('utf-8').decode(content);
			}
		});

		await vscode.commands.executeCommand('vsmemo.moveFilesToPresetFolder', source1, [source1, source2]);

		assert(fsWriteFileStub.calledOnce);
		assert(writtenContent.includes('<!-- VSMemo Index Start -->\n- [file1](./file1.md)\n<!-- VSMemo Index End -->'));
		assert(!writtenContent.includes('file2'));
		assert(showWarningMessageSpy.calledTwice);
		assert(showWarningMessageSpy.secondCall.calledWith('Move partially failed. 1 succeeded, 1 failed.'));
	});
});
