import * as assert from 'assert';
import * as path from 'path';
import {
	AutoRevealExcludeDependencies,
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
	initialWorkspaceExclusions: Record<string, boolean> = {},
	initialEffectiveExclusions: Record<string, boolean> = initialWorkspaceExclusions
): AutoRevealExcludeDependencies & {
	updated: Record<string, boolean>[];
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
	const updated: Record<string, boolean>[] = [];
	const confirmations: string[][] = [];
	const messages: string[] = [];
	let confirmResult = true;

	const dependencies: AutoRevealExcludeDependencies & {
		updated: Record<string, boolean>[];
		confirmations: string[][];
		messages: string[];
		setConfirmResult(value: boolean): void;
	} = {
		updated,
		confirmations,
		messages,
		loadDestinations: () => destinations,
		resolveDestination(destinationPath) {
			const normalizedPath = path.normalize(destinationPath.replace(/[\\/]/g, path.sep));
			const matches = folders
				.map(folder => ({ folder, glob: buildAutoRevealExclusionGlob(folder.path, normalizedPath) }))
				.filter(item => item.glob !== undefined)
				.sort((a, b) => b.folder.path.length - a.folder.path.length);
			const match = matches[0];
			return match ? { workspaceFolderPath: match.folder.path, destinationPath: normalizedPath } : undefined;
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

	test('adds multiple destinations relative to their own workspace roots and skips outside paths', async () => {
		const dependencies = dependenciesFor(
			[
				destination('Inbox', '/workspace/first/notes/inbox'),
				destination('Archive', '/workspace/second/notes/archive'),
				destination('External', '/outside/archive')
			],
			[
				{ path: '/workspace/first', name: 'First' },
				{ path: '/workspace/second', name: 'Second' }
			],
			{ 'generated/**': true },
			{ '**/node_modules/**': true, 'generated/**': true }
		);

		await configureMoveDestinationAutoRevealExclude(dependencies);

		assert.deepStrictEqual(dependencies.updated, [{
			'generated/**': true,
			'notes/inbox/**': true,
			'notes/archive/**': true
		}]);
		assert.deepStrictEqual(dependencies.getEffectiveExclusions(), {
			'**/node_modules/**': true,
			'generated/**': true,
			'notes/inbox/**': true,
			'notes/archive/**': true
		});
		assert.deepStrictEqual(dependencies.confirmations, [['notes/inbox/**', 'notes/archive/**']]);
		assert.deepStrictEqual(dependencies.messages, [
			'Explorer auto-reveal exclusions updated: 2 added, 0 already configured, 1 skipped.'
		]);
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
