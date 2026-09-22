import * as path from 'path';
import * as vscode from 'vscode';
import { loadMoveDestinations, MoveDestination } from './moveDestinations';

const applyLabel = 'Apply';

export interface DestinationPathResolution {
	workspaceFolderPath: string;
	destinationPath: string;
}

export interface AutoRevealExcludeDependencies {
	loadDestinations(): MoveDestination[];
	resolveDestination(destinationPath: string): DestinationPathResolution | undefined;
	getEffectiveExclusions(): Record<string, boolean>;
	getWorkspaceExclusions(): Record<string, boolean>;
	confirm(patterns: string[]): Promise<boolean>;
	updateWorkspaceExclusions(value: Record<string, boolean>): Promise<void>;
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

	if (!relativePath || relativePath === '.') {
		return '**';
	}

	return `${relativePath.split(/[\\/]/).join('/')}/**`;
}

export function mergeAutoRevealExclusions(
	current: Record<string, boolean>,
	additions: string[]
): { value: Record<string, boolean>; added: number } {
	const value = { ...current };
	let added = 0;

	for (const pattern of additions) {
		if (value[pattern] !== true) {
			value[pattern] = true;
			added++;
		}
	}

	return { value: added === 0 ? current : value, added };
}

function getDefaultDependencies(): AutoRevealExcludeDependencies {
	return {
		loadDestinations: loadMoveDestinations,
		resolveDestination(destinationPath) {
			if (path.win32.isAbsolute(destinationPath) && !path.isAbsolute(destinationPath)) {
				return undefined;
			}
			const uri = vscode.Uri.file(destinationPath.replace(/\\/g, '/'));
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
			return workspaceFolder ? {
				workspaceFolderPath: workspaceFolder.uri.fsPath,
				destinationPath: uri.fsPath
			} : undefined;
		},
		getEffectiveExclusions() {
			return vscode.workspace.getConfiguration('explorer').get<Record<string, boolean>>('autoRevealExclude', {});
		},
		getWorkspaceExclusions() {
			return vscode.workspace.getConfiguration('explorer').inspect<Record<string, boolean>>('autoRevealExclude')?.workspaceValue ?? {};
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
			const resolution = dependencies.resolveDestination(destination.resolvedPath);
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
		const initiallyMissing = allPatterns.filter(pattern => initialEffectiveExclusions[pattern] !== true);
		if (initiallyMissing.length > 0 && !(await dependencies.confirm(initiallyMissing))) {
			return;
		}

		// Re-read after confirmation so edits made while the dialog was open are preserved.
		const effectiveExclusions = dependencies.getEffectiveExclusions();
		const missingPatterns = allPatterns.filter(pattern => effectiveExclusions[pattern] !== true);
		const merged = mergeAutoRevealExclusions(dependencies.getWorkspaceExclusions(), missingPatterns);
		if (merged.added > 0) {
			await dependencies.updateWorkspaceExclusions(merged.value);
		}

		const alreadyConfigured = allPatterns.length - merged.added;
		const skippedMessage = skipped > 0 ? `, ${skipped} skipped` : '';
		dependencies.showInformationMessage(
			`Explorer auto-reveal exclusions updated: ${merged.added} added, ${alreadyConfigured} already configured${skippedMessage}.`
		);
	} catch (error) {
		const detail = error instanceof Error ? error.message : 'Check the VSMemo move destination configuration and workspace settings.';
		dependencies.showErrorMessage(`Failed to configure Explorer auto-reveal exclusions: ${detail}`);
	}
}
