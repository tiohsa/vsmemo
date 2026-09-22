import * as assert from 'assert';
import {
	AutoRevealExcludeDependencies,
	AutoRevealExclusions,
	resolveAutoRevealDestination,
	buildAutoRevealExclusionGlob,
	configureMoveDestinationAutoRevealExclude,
	mergeAutoRevealExclusions
} from '../autoRevealExclude';
import { MoveDestination } from '../moveDestinations';

function destination(name: string, resolvedPath: string): MoveDestination {
	return { name, rawPath: resolvedPath, resolvedPath };
}

function dependenciesFor(
	destinations: MoveDestination[],
	folders: Array<{ path: string; name: string }>,
	initialWorkspaceExclusions: AutoRevealExclusions = {},
	initialEffectiveExclusions: AutoRevealExclusions = initialWorkspaceExclusions
): AutoRevealExcludeDependencies & {
	updated: AutoRevealExclusions[];
	confirmations: string[][];
	messages: string[];
	setConfirmResult(value: boolean): void;
} {
	let workspaceExclusions = initialWorkspaceExclusions;
	let effectiveExclusions = initialEffectiveExclusions;
	const inheritedExclusions = { ...initialEffectiveExclusions };
	for (const key of Object.keys(initialWorkspaceExclusions)) {
		delete inheritedExclusions[key];
	}
	const updated: AutoRevealExclusions[] = [];
	const confirmations: string[][] = [];
	const messages: string[] = [];
	let confirmResult = true;

	const dependencies: AutoRevealExcludeDependencies & {
		updated: AutoRevealExclusions[];
		confirmations: string[][];
		messages: string[];
		setConfirmResult(value: boolean): void;
	} = {
		updated,
		confirmations,
		messages,
		loadDestinations: () => destinations,
		resolveDestination(destinationPath) {
			return resolveAutoRevealDestination(destinationPath, folders.map(folder => folder.path));
		},
		getEffectiveExclusions: () => effectiveExclusions,
		getWorkspaceExclusions: () => workspaceExclusions,
		async confirm(patterns) {
			confirmations.push(patterns);
			return confirmResult;
		},
		async updateWorkspaceExclusions(value) {
			updated.push(value);
			workspaceExclusions = value;
			effectiveExclusions = { ...inheritedExclusions, ...value };
		},
		showInformationMessage: message => messages.push(message),
		showErrorMessage: message => messages.push(message),
		setConfirmResult(value: boolean) { confirmResult = value; }
	};

	return dependencies;
}

suite('Explorer auto-reveal exclusions', () => {
	test('skips destinations equal to the workspace root', () => {
		assert.strictEqual(buildAutoRevealExclusionGlob('/workspace', '/workspace'), undefined);
		assert.strictEqual(buildAutoRevealExclusionGlob('/workspace', '/workspace/notes/..'), undefined);
	});

	test('converts workspace destinations to forward-slash globs', () => {
		assert.strictEqual(
			buildAutoRevealExclusionGlob('/workspace', '/workspace/notes/archive'),
			'notes/archive/**'
		);
		assert.strictEqual(
			buildAutoRevealExclusionGlob('/workspace', '/workspace/notes\\archive'),
			'notes/archive/**'
		);
	});

	test('does not prompt or write exclusions when every destination is the workspace root', async () => {
		const dependencies = dependenciesFor([
			destination('Absolute root', '/workspace'),
			destination('Variable root', '${workspaceFolder}'),
			destination('Relative root', '.')
		], [{ path: '/workspace', name: 'Workspace' }]);

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.confirmations, []);
		assert.deepStrictEqual(dependencies.updated, []);
		assert.match(dependencies.messages[0], /0 added, 0 already configured, 3 skipped/);
	});

	test('excludes nested destinations while reporting the workspace root as skipped', async () => {
		const dependencies = dependenciesFor([
			destination('Root', '/workspace'),
			destination('Archive', '/workspace/notes/archive')
		], [{ path: '/workspace', name: 'Workspace' }]);

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.confirmations, [['notes/archive/**']]);
		assert.deepStrictEqual(dependencies.updated, [{ 'notes/archive/**': true }]);
		assert.match(dependencies.messages[0], /1 added, 0 already configured, 1 skipped/);
	});

	test('preserves existing exclusions and is idempotent', () => {
		const existing = { '**/node_modules/**': true, 'notes/archive/**': true };
		const firstRun = mergeAutoRevealExclusions(existing, ['notes/archive/**', 'notes/inbox/**']);
		assert.deepStrictEqual(firstRun.value, {
			'**/node_modules/**': true,
			'notes/archive/**': true,
			'notes/inbox/**': true
		});
		assert.strictEqual(firstRun.added, 1);

		const secondRun = mergeAutoRevealExclusions(firstRun.value, ['notes/archive/**', 'notes/inbox/**']);
		assert.strictEqual(secondRun.value, firstRun.value);
		assert.strictEqual(secondRun.added, 0);
	});

	test('skips multi-root destinations instead of applying a relative glob to every root', async () => {
		const dependencies = dependenciesFor([
			destination('Archive', '/workspace/second/notes/archive'),
			destination('FirstArchive', '/workspace/first/notes/archive'),
			destination('Variable', '${workspaceFolder}/notes/archive'),
			destination('Relative', 'notes/archive'),
			destination('External', '/outside/archive')
		], [{ path: '/workspace/first', name: 'First' }, { path: '/workspace/second', name: 'Second' }]);
		await configureMoveDestinationAutoRevealExclude(dependencies);
		assert.deepStrictEqual(dependencies.updated, []);
		assert.deepStrictEqual(dependencies.confirmations, []);
		assert.match(dependencies.messages[0], /5 skipped \(ambiguous workspace/);
	});

	test('resolves raw configured paths in a single root and skips outside or unsupported paths', async () => {
		const dependencies = dependenciesFor([
			destination('Variable', '${workspaceFolder}/notes/archive'),
			destination('Relative', 'notes/inbox'),
			destination('External', '/outside/archive'),
			destination('Remote', 'vscode-remote://host/archive'),
			destination('OtherOS', 'C:\\archive'),
			destination('Pattern', '/workspace/notes/[archive]')
		], [{ path: '/workspace', name: 'Workspace' }]);
		await configureMoveDestinationAutoRevealExclude(dependencies);
		assert.deepStrictEqual(dependencies.updated, [{ 'notes/archive/**': true, 'notes/inbox/**': true }]);
		assert.match(dependencies.messages[0], /2 added.*4 skipped/);
	});

	test('preserves conditional exclusions when merging generated patterns', async () => {
		const conditional = { when: '$(basename).ts' };
		const dependencies = dependenciesFor([destination('Archive', '/workspace/notes/archive')],
			[{ path: '/workspace', name: 'Workspace' }], { '**/*.js': conditional });
		await configureMoveDestinationAutoRevealExclude(dependencies);
		assert.deepStrictEqual(dependencies.updated, [{ '**/*.js': conditional, 'notes/archive/**': true }]);
		assert.deepStrictEqual(mergeAutoRevealExclusions({ 'notes/archive/**': conditional }, ['notes/archive/**']),
			{ value: { 'notes/archive/**': conditional }, added: 0 });
	});

	test('re-reads workspace exclusions after confirmation', async () => {
		const dependencies = dependenciesFor([destination('Archive', '/workspace/notes/archive')],
			[{ path: '/workspace', name: 'Workspace' }]);
		dependencies.confirm = async () => {
			dependencies.getWorkspaceExclusions = () => ({ 'new/**': { when: '$(basename).ts' } });
			return true;
		};
		await configureMoveDestinationAutoRevealExclude(dependencies);
		assert.deepStrictEqual(dependencies.updated, [{ 'new/**': { when: '$(basename).ts' }, 'notes/archive/**': true }]);
	});

	test('does not update settings when confirmation is cancelled', async () => {
		const dependencies = dependenciesFor(
			[destination('Archive', '/workspace/notes/archive')],
			[{ path: '/workspace', name: 'Workspace' }]
		);
		dependencies.setConfirmResult(false);

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.confirmations, [['notes/archive/**']]);
		assert.deepStrictEqual(dependencies.updated, []);
		assert.deepStrictEqual(dependencies.messages, []);
	});

	test('uses existing destination validation errors', async () => {
		const dependencies = dependenciesFor([], [{ path: '/workspace', name: 'Workspace' }]);
		dependencies.loadDestinations = () => { throw new Error('Invalid configuration: destination path must be a string.'); };

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.updated, []);
		assert.deepStrictEqual(dependencies.messages, [
			'Failed to configure Explorer auto-reveal exclusions: Invalid configuration: destination path must be a string.'
		]);
	});

	test('does not prompt or update again when exclusions are already configured', async () => {
		const configured = { 'notes/archive/**': true };
		const dependencies = dependenciesFor(
			[destination('Archive', '/workspace/notes/archive')],
			[{ path: '/workspace', name: 'Workspace' }],
			configured,
			configured
		);

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.confirmations, []);
		assert.deepStrictEqual(dependencies.updated, []);
		assert.deepStrictEqual(dependencies.messages, [
			'Explorer auto-reveal exclusions updated: 0 added, 1 already configured.'
		]);
	});
});
