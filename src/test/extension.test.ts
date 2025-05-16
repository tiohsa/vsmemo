import assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';
import { activate } from '../extension';

suite('Extension Test Suite - vsmemo.createDateNote', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let sandbox: sinon.SinonSandbox;
	let mockContext: vscode.ExtensionContext;
	let showErrorMessageSpy: sinon.SinonSpy;
	let showInputBoxStub: sinon.SinonStub;
	let getConfigurationStub: sinon.SinonStub;
	let workspaceFoldersGetterStub: sinon.SinonStub; // For stubbing the getter of workspace.workspaceFolders
	let statStub: sinon.SinonStub;
	let mkdirStub: sinon.SinonStub;
	let writeFileStub: sinon.SinonStub;
	let openTextDocumentStub: sinon.SinonStub;
	let showTextDocumentStub: sinon.SinonStub;

	const mockWorkspaceFolder = {
		uri: vscode.Uri.file(path.sep + path.join('test', 'workspace')), // Use path.sep for platform-agnostic paths
		name: 'test-workspace',
		index: 0
	};

	setup(() => {
		sandbox = sinon.createSandbox();

		mockContext = {
			subscriptions: [],
			workspaceState: { get: sinon.stub(), update: sinon.stub(), keys: sinon.stub() },
			globalState: { get: sinon.stub(), update: sinon.stub(), keys: sinon.stub(), setKeysForSync: sinon.stub() },
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
			secrets: { get: sinon.stub(), store: sinon.stub(), delete: sinon.stub(), onDidChange: sinon.stub() },
		} as unknown as vscode.ExtensionContext;

		showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');
		showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');

		getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
		getConfigurationStub.withArgs('vsmemo').returns({
			get: (key: string) => {
				if (key === 'createDirectory') return path.sep + path.join('test', 'notes');
				if (key === 'fileNameFormat') return '${yyyy}-${MM}-${dd}-${title}.${ext}';
				return undefined;
			},
			has: sinon.stub().returns(true),
			inspect: sinon.stub(),
			update: sinon.stub()
		});

		// Stub the getter for vscode.workspace.workspaceFolders
		workspaceFoldersGetterStub = sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [mockWorkspaceFolder]);

		statStub = sandbox.stub(fs.promises, 'stat');
		mkdirStub = sandbox.stub(fs.promises, 'mkdir');
		writeFileStub = sandbox.stub(fs.promises, 'writeFile');

		openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument');
		showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument');

		// Activate the extension to register commands.
		// This ensures that the command callback is created with the stubs active.
		activate(mockContext);
	});

	teardown(() => {
		sandbox.restore();
		// Dispose of subscriptions
		mockContext.subscriptions.forEach(sub => sub.dispose());
		mockContext.subscriptions.length = 0; // Clear the array
	});

	async function executeCreateDateNoteCommand() {
		// The command is registered in `setup` by calling `activate`.
		await vscode.commands.executeCommand('vsmemo.createDateNote');
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

	test('Should use workspaceFolder when ${workspaceFolder} is in createDirectory', async () => {
		const workspacePath = mockWorkspaceFolder.uri.fsPath;
		const relativeDir = 'notes_in_ws';
		const configuredDir = `\${workspaceFolder}${path.sep}${relativeDir}`;
		const expectedDir = path.join(workspacePath, relativeDir);
		const testTitle = 'Workspace Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(expectedDir, expectedFileName);

		getConfigurationStub.withArgs('vsmemo').returns({
			get: (key: string) => {
				if (key === 'createDirectory') return configuredDir;
				if (key === 'fileNameFormat') return '${yyyy}-${MM}-${dd}-${title}.${ext}';
				return undefined;
			},
			has: sinon.stub().returns(true), inspect: sinon.stub(), update: sinon.stub()
		});

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
		getConfigurationStub.withArgs('vsmemo').returns({
			get: (key: string) => {
				if (key === 'createDirectory') return `\${workspaceFolder}${path.sep}notes`;
				if (key === 'fileNameFormat') return '${yyyy}-${MM}-${dd}-${title}.${ext}';
				return undefined;
			},
			has: sinon.stub().returns(true), inspect: sinon.stub(), update: sinon.stub()
		});
		// workspaceFoldersGetterStubはgetter stubなので、値を直接セット
		workspaceFoldersGetterStub.get(() => undefined); // No workspace folders

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

		getConfigurationStub.withArgs('vsmemo').returns({
			get: (key: string) => (key === 'createDirectory' ? testDir : '${yyyy}-${MM}-${dd}-${title}.${ext}'),
			has: sinon.stub().returns(true), inspect: sinon.stub(), update: sinon.stub()
		});

		showInputBoxStub.resolves(testTitle);
		statStub.withArgs(testDir).resolves({ isDirectory: () => true } as fs.Stats); // Directory exists

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should check directory');
		assert(mkdirStub.notCalled, 'fs.mkdir should not be called');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file in existing directory');
	});

	test('Should show error from mkdir if stat fails (non-ENOENT) and mkdir also fails', async () => {
		const testDir = path.sep + path.join('test', 'notes_stat_fail');
		showInputBoxStub.resolves("Test Title");
		const statError = new Error('Permission denied for stat');
		(statError as any).code = 'EACCES';
		statStub.withArgs(testDir).rejects(statError);

		const mkdirError = new Error('Permission denied for mkdir');
		mkdirStub.withArgs(testDir, { recursive: true }).rejects(mkdirError);

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should be called once');
		assert(mkdirStub.calledOnceWith(testDir, { recursive: true }), 'mkdir should be attempted once due to broad catch');
		assert(showErrorMessageSpy.calledOnceWith('Failed to create note: ' + mkdirError.message), 'Error message from mkdir failure');
	});

	test('Should create note if stat fails (non-ENOENT) but mkdir succeeds', async () => {
		const testDir = path.sep + path.join('test', 'notes_stat_fail_mkdir_ok');
		const testTitle = 'StatFail MkdirOk Note';
		const now = new Date();
		const expectedFileName = `${formatDate(now, 'yyyy')}-${formatDate(now, 'MM')}-${formatDate(now, 'dd')}-${testTitle}.md`;
		const expectedFilePath = path.join(testDir, expectedFileName);

		showInputBoxStub.resolves(testTitle);
		const statError = new Error('Permission denied for stat');
		(statError as any).code = 'EACCES'; // Non-ENOENT error
		statStub.withArgs(testDir).rejects(statError);
		mkdirStub.withArgs(testDir, { recursive: true }).resolves(undefined); // mkdir succeeds

		writeFileStub.withArgs(expectedFilePath, '').resolves(undefined);
		const mockDoc = { uri: vscode.Uri.file(expectedFilePath) } as vscode.TextDocument;
		openTextDocumentStub.withArgs(expectedFilePath).resolves(mockDoc);
		showTextDocumentStub.withArgs(mockDoc).resolves(undefined);

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should be called once');
		assert(mkdirStub.calledOnceWith(testDir, { recursive: true }), 'fs.mkdir should be called once and succeed');
		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should create file after mkdir success');
		assert(openTextDocumentStub.calledOnceWith(expectedFilePath), 'openTextDocument should be called');
		assert(showTextDocumentStub.calledOnceWith(mockDoc), 'showTextDocument should be called');
		assert(showErrorMessageSpy.notCalled, 'showErrorMessage should not be called');
	});

	test('Should show error if fs.promises.writeFile fails', async () => {
		const testDir = path.sep + path.join('test', 'notes'); // Using default from setup
		const testTitle = 'Write Fail Note';
		const now = new Date();
		// Get the format from the default stubbed configuration
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
		statStub.resolves({ isDirectory: () => true } as fs.Stats); // Dir exists
		const writeFileError = new Error('writeFile failed');
		writeFileStub.withArgs(expectedFilePath, '').rejects(writeFileError);

		await executeCreateDateNoteCommand();

		assert(writeFileStub.calledOnceWith(expectedFilePath, ''), 'fs.writeFile should be attempted with correct args');
		assert(showErrorMessageSpy.calledOnceWith('Failed to create note: ' + writeFileError.message));
	});

	test('Should handle directory already existing as a file', async () => {
		const testDir = path.sep + path.join('test', 'notes_is_file');
		showInputBoxStub.resolves("Test Title");
		const statResult = { isDirectory: () => false, isFile: () => true } as fs.Stats;
		statStub.withArgs(testDir).resolves(statResult);

		await executeCreateDateNoteCommand();

		assert(statStub.calledOnceWith(testDir), 'fs.stat should check the path once');
		assert(mkdirStub.notCalled, 'fs.mkdir should not be called');
		assert(writeFileStub.notCalled, 'fs.writeFile should not be called');
		assert(showErrorMessageSpy.calledOnceWith(`Failed to create note: ${testDir} exists but is not a directory`),
			'Error message for existing file instead of directory');
	});
});
