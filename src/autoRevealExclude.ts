import * as path from 'path';
import * as vscode from 'vscode';
import { loadConfiguredMoveDestinations, ConfiguredMoveDestination } from './moveDestinations';

const applyLabel = 'Apply';

export type AutoRevealExclusions = Record<string, boolean | { when?: string }>;

export interface DestinationPathResolution {
	workspaceFolderPath: string;
	destinationPath: string;
}

export interface AutoRevealExcludeDependencies {
	loadDestinations(): ConfiguredMoveDestination[];
	resolveDestination(destinationPath: string): DestinationPathResolution | undefined;
	getEffectiveExclusions(): AutoRevealExclusions;
	getWorkspaceExclusions(): AutoRevealExclusions;
	confirm(patterns: string[]): Promise<boolean>;
	updateWorkspaceExclusions(value: AutoRevealExclusions): Promise<void>;
	showInformationMessage(message: string): void;
	showErrorMessage(message: string): void;
}

function normalizeFilePath(filePath: string): string {
	return path.normalize(filePath.replace(/[\\/]/g, path.sep));
}

export function buildAutoRevealExclusionGlob(workspaceFolderPath: string, destinationPath: string): string | undefined {
	const folderPath = normalizeFilePath(workspaceFolderPath);
	const targetPath = normalizeFilePath(destinationPath);

	// A Windows absolute path cannot be a descendant of a POSIX workspace (and vice versa).
	if (path.win32.isAbsolute(targetPath) && !path.isAbsolute(targetPath)) {
		return undefined;
	}

	const relativePath = path.relative(folderPath, targetPath);
	if (path.isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
		return undefined;
	}

	if (/[\[\]{}*?!]/.test(relativePath)) { return undefined; }

	if (!relativePath || relativePath === '.') {
		return '**';
	}

	return `${relativePath.split(/[\\/]/).join('/')}/**`;
}

export function mergeAutoRevealExclusions(
	current: AutoRevealExclusions,
	additions: string[]
): { value: AutoRevealExclusions; added: number } {
	const value = { ...current };
	let added = 0;

	for (const pattern of additions) {
		if (value[pattern] !== true && typeof value[pattern] !== 'object') {
			value[pattern] = true;
			added++;
		}
	}

	return { value: added === 0 ? current : value, added };
}

/** Workspace exclusions use relative globs in every root, so multiple roots cannot be scoped safely. */
export function resolveAutoRevealDestination(rawPath: string, workspacePaths: readonly string[]): DestinationPathResolution | undefined {
	if (workspacePaths.length !== 1 || /^[a-z][a-z0-9+.-]*:\/\//i.test(rawPath)
		|| (path.win32.isAbsolute(rawPath) && !path.isAbsolute(rawPath))) {
		return undefined;
	}
	const workspaceFolderPath = workspacePaths[0];
	const expanded = rawPath.replace(/\$\{workspaceFolder\}/g, () => workspaceFolderPath);
	if (expanded.includes('${')) { return undefined; }
	const destinationPath = path.resolve(workspaceFolderPath, normalizeFilePath(expanded));
	return { workspaceFolderPath, destinationPath };
}

function getDefaultDependencies(): AutoRevealExcludeDependencies {
	return {
		loadDestinations: loadConfiguredMoveDestinations,
		resolveDestination(rawPath) {
			return resolveAutoRevealDestination(rawPath,
				(vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath));
		},
		getEffectiveExclusions() {
			return vscode.workspace.getConfiguration('explorer').get<AutoRevealExclusions>('autoRevealExclude', {});
		},
		getWorkspaceExclusions() {
			return vscode.workspace.getConfiguration('explorer').inspect<AutoRevealExclusions>('autoRevealExclude')?.workspaceValue ?? {};
		},
		async confirm(patterns) {
			const shownPatterns = patterns.slice(0, 8);
			const omittedCount = patterns.length - shownPatterns.length;
			const list = shownPatterns.map(pattern => `- ${pattern}`).join('\n');
			const more = omittedCount > 0 ? `\n- and ${omittedCount} more` : '';
			const choice = await vscode.window.showWarningMessage(
				`Add Explorer auto-reveal exclusions for ${patterns.length} VSMemo move destinations?\n\n${list}${more}`,
				{ modal: true },
				applyLabel,
				'Cancel'
			);
			return choice === applyLabel;
		},
		async updateWorkspaceExclusions(value) {
			await vscode.workspace.getConfiguration('explorer').update(
				'autoRevealExclude',
				value,
				vscode.ConfigurationTarget.Workspace
			);
		},
		showInformationMessage(message) {
			void vscode.window.showInformationMessage(message);
		},
		showErrorMessage(message) {
			void vscode.window.showErrorMessage(message);
		}
	};
}

export async function configureMoveDestinationAutoRevealExclude(
	dependencies: AutoRevealExcludeDependencies = getDefaultDependencies()
): Promise<void> {
	try {
		const destinations = dependencies.loadDestinations();
		const patterns = new Set<string>();
		let skipped = 0;

		for (const destination of destinations) {
			const resolution = dependencies.resolveDestination(destination.rawPath);
			const pattern = resolution
				? buildAutoRevealExclusionGlob(resolution.workspaceFolderPath, resolution.destinationPath)
				: undefined;
			if (pattern === undefined) {
				skipped++;
			} else {
				patterns.add(pattern);
			}
		}

		const allPatterns = [...patterns];
		const initialEffectiveExclusions = dependencies.getEffectiveExclusions();
		const initiallyMissing = allPatterns.filter(pattern => initialEffectiveExclusions[pattern] !== true && typeof initialEffectiveExclusions[pattern] !== 'object');
		if (initiallyMissing.length > 0 && !(await dependencies.confirm(initiallyMissing))) {
			return;
		}

		// Re-read after confirmation so edits made while the dialog was open are preserved.
		const effectiveExclusions = dependencies.getEffectiveExclusions();
		const missingPatterns = allPatterns.filter(pattern => effectiveExclusions[pattern] !== true && typeof effectiveExclusions[pattern] !== 'object');
		const merged = mergeAutoRevealExclusions(dependencies.getWorkspaceExclusions(), missingPatterns);
		if (merged.added > 0) {
			await dependencies.updateWorkspaceExclusions(merged.value);
		}

		const alreadyConfigured = allPatterns.length - merged.added;
		const skippedMessage = skipped > 0 ? `, ${skipped} skipped (ambiguous workspace, outside workspace, or unsupported path)` : '';
		dependencies.showInformationMessage(
			`Explorer auto-reveal exclusions updated: ${merged.added} added, ${alreadyConfigured} already configured${skippedMessage}.`
		);
	} catch (error) {
		const detail = error instanceof Error ? error.message : 'Check the VSMemo move destination configuration and workspace settings.';
		dependencies.showErrorMessage(`Failed to configure Explorer auto-reveal exclusions: ${detail}`);
	}
}
