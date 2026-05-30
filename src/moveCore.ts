import * as path from 'path';
import * as vscode from 'vscode';
import { loadMoveDestinations, MoveDestination } from './moveDestinations';

export interface MoveOptions {
	context: vscode.ExtensionContext;
	selectedUri?: vscode.Uri;
	allSelectedUris?: vscode.Uri[];
	fixedDestinationKey?: string;
}

/**
 * Common move workflow (Move Core)
 */
export async function moveCore(options: MoveOptions): Promise<void> {
	const { context, selectedUri, allSelectedUris, fixedDestinationKey } = options;

	// Resolve targets
	let uris: vscode.Uri[] = [];
	if (allSelectedUris && allSelectedUris.length > 0) {
		uris = allSelectedUris;
	} else if (selectedUri) {
		uris = [selectedUri];
	} else {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			uris = [activeEditor.document.uri];
		}
	}

	// PC-01: At least one target exists
	if (uris.length === 0) {
		vscode.window.showErrorMessage('Move cancelled. No files selected.');
		return;
	}

	// PC-02: All targets are supported file system resources
	for (const uri of uris) {
		if (uri.scheme !== 'file') {
			vscode.window.showErrorMessage('Move cancelled. Unsupported URI scheme.');
			return;
		}
		// Reject untitled files
		if (uri.path.includes('Untitled') || uri.fsPath.endsWith('Untitled') || (uri.scheme as string) === 'untitled') {
			vscode.window.showErrorMessage('Move cancelled. Untitled files cannot be moved.');
			return;
		}
	}

	// Unsaved (dirty) state handling
	for (const uri of uris) {
		const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
		if (doc && doc.isDirty) {
			if (doc.isUntitled) {
				vscode.window.showErrorMessage('Move cancelled. Untitled files cannot be moved.');
				return;
			}
			const action = await vscode.window.showWarningMessage(
				`File has unsaved changes: ${path.basename(uri.fsPath)}. Save before moving?`,
				'Save',
				'Cancel'
			);
			if (action === 'Save') {
				const saved = await doc.save();
				if (!saved) {
					vscode.window.showErrorMessage(`Failed to save file: ${path.basename(uri.fsPath)}`);
					return;
				}
			} else {
				// Cancelled
				return;
			}
		}
	}

	// PC-03: All targets are files, not folders
	for (const uri of uris) {
		try {
			const stat = await vscode.workspace.fs.stat(uri);
			if ((stat.type & vscode.FileType.Directory) !== 0) {
				vscode.window.showErrorMessage('Move cancelled. Folders are not supported.');
				return;
			}
		} catch {
			vscode.window.showErrorMessage(`Move cancelled. File not found: ${path.basename(uri.fsPath)}`);
			return;
		}
	}

	// PC-04: Destination setting exists and is valid
	let destinations: MoveDestination[];
	try {
		destinations = loadMoveDestinations();
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
		return;
	}

	const config = vscode.workspace.getConfiguration('vsmemo');

	// Resolve destination
	let selectedDest: MoveDestination | undefined;

	if (fixedDestinationKey) {
		// Used by Archive command or presets with specific key
		selectedDest = destinations.find(d => d.name === fixedDestinationKey);
		if (!selectedDest) {
			vscode.window.showErrorMessage(`Move cancelled. Archive destination key "${fixedDestinationKey}" does not exist.`);
			return;
		}
	} else {
		// Display QuickPick with Recent Destinations support
		const recentEnabled = config.get<boolean>('recentDestinations.enabled', true);
		const recentKeys = context.workspaceState.get<string[]>('vsmemo.recentDestinations', []);

		// Filter out recent keys that are not present in current configurations
		const validRecentKeys = recentKeys.filter(k => destinations.some(d => d.name === k));

		let orderedDestinations: MoveDestination[] = [];
		if (recentEnabled && validRecentKeys.length > 0) {
			// Put recent destinations at the top
			const recentDests = validRecentKeys.map(k => destinations.find(d => d.name === k)!).filter(Boolean);
			const otherDests = destinations.filter(d => !validRecentKeys.includes(d.name));
			orderedDestinations = [...recentDests, ...otherDests];
		} else {
			orderedDestinations = destinations;
		}

		const items: vscode.QuickPickItem[] = orderedDestinations.map(d => {
			const isRecent = validRecentKeys.includes(d.name);
			return {
				label: d.name,
				description: d.rawPath,
				detail: isRecent ? '$(history) Recently used' : undefined
			};
		});

		const selectedItem = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a destination folder'
		});

		if (!selectedItem) {
			// Cancelled by user
			return;
		}

		selectedDest = destinations.find(d => d.name === selectedItem.label)!;
	}

	const destFolderUri = vscode.Uri.file(selectedDest.resolvedPath);

	// PC-06: Destination is not an existing file
	try {
		const destStat = await vscode.workspace.fs.stat(destFolderUri);
		if ((destStat.type & vscode.FileType.File) !== 0) {
			vscode.window.showErrorMessage(`Move cancelled. Destination path is a file, not a folder: ${selectedDest.resolvedPath}`);
			return;
		}
	} catch {
		// Folder doesn't exist, which is fine
	}

	// Analyze conflict and same path checks (PC-08, PC-09, PC-10)
	const moves: { source: vscode.Uri; target: vscode.Uri; filename: string }[] = [];
	const conflicts: string[] = [];
	const samePaths: string[] = [];

	for (const uri of uris) {
		const filename = path.basename(uri.fsPath);
		const targetUri = vscode.Uri.joinPath(destFolderUri, filename);

		// PC-09: Source and destination are not the same
		if (uri.fsPath === targetUri.fsPath) {
			samePaths.push(filename);
			continue;
		}

		// PC-08, PC-10: No destination file conflicts exist (do not overwrite)
		try {
			await vscode.workspace.fs.stat(targetUri);
			conflicts.push(filename);
		} catch {
			// File does not exist, no conflict
		}

		moves.push({ source: uri, target: targetUri, filename });
	}

	if (samePaths.length > 0) {
		vscode.window.showErrorMessage('Move cancelled. Source and destination are the same.');
		return;
	}

	if (conflicts.length > 0) {
		let message = '';
		if (conflicts.length <= 3) {
			message = `Move cancelled. Destination already contains: ${conflicts.join(', ')}`;
		} else {
			const displayed = conflicts.slice(0, 3).join(', ');
			const remaining = conflicts.length - 3;
			message = `Move cancelled. Destination already contains: ${displayed} and ${remaining} more file(s)`;
		}
		vscode.window.showErrorMessage(message);
		return;
	}

	// Move Confirmation Summary (MCS-01 to MCS-08)
	const confirmationEnabled = config.get<boolean>('moveConfirmation.enabled', true);
	// Apply confirmation by default to multiple-file moves. Skip by default for single-file moves.
	if (confirmationEnabled && uris.length > 1) {
		let summaryDetail = '';
		if (uris.length <= 5) {
			summaryDetail = uris.map(u => path.basename(u.fsPath)).join('\n');
		} else {
			const firstFew = uris.slice(0, 5).map(u => path.basename(u.fsPath)).join('\n');
			const remaining = uris.length - 5;
			summaryDetail = `${firstFew}\n... and ${remaining} more file(s)`;
		}

		const confirm = await vscode.window.showWarningMessage(
			`Are you sure you want to move ${uris.length} files to "${selectedDest.name}"?\n\nFiles:\n${summaryDetail}`,
			{ modal: true },
			'Move Files'
		);

		if (confirm !== 'Move Files') {
			// Cancelled
			return;
		}
	}

	// PC-07: Create the destination folder if it does not exist
	try {
		await vscode.workspace.fs.createDirectory(destFolderUri);
	} catch (error) {
		vscode.window.showErrorMessage(`Move cancelled. Failed to create destination folder: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}

	// Execute file moves sequentially
	let successCount = 0;
	let failCount = 0;
	const successfullyMovedFiles: vscode.Uri[] = [];

	for (const move of moves) {
		try {
			await vscode.workspace.fs.rename(move.source, move.target, { overwrite: false });
			successCount++;
			successfullyMovedFiles.push(move.target);
		} catch {
			failCount++;
		}
	}

	// Update Recent Destinations (RD-01 to RD-05)
	if (successCount > 0) {
		const recentEnabled = config.get<boolean>('recentDestinations.enabled', true);
		if (recentEnabled) {
			const recentKeys = context.workspaceState.get<string[]>('vsmemo.recentDestinations', []);
			const maxItems = config.get<number>('recentDestinations.maxItems', 5);

			// Remove duplicate if it exists and push to front
			const filteredKeys = recentKeys.filter(k => k !== selectedDest!.name);
			const updatedKeys = [selectedDest.name, ...filteredKeys].slice(0, maxItems);

			await context.workspaceState.update('vsmemo.recentDestinations', updatedKeys);
		}
	}

	// Auto Index Update (AIU-01 to AIU-09)
	let indexUpdateSuccess = true;
	const indexEnabled = config.get<boolean>('autoIndexUpdate.enabled', false);
	if (indexEnabled && successCount > 0) {
		try {
			const indexFileName = config.get<string>('autoIndexUpdate.fileName', 'index.md');
			const indexUri = vscode.Uri.joinPath(destFolderUri, indexFileName);

			// 1. Scan all markdown files in destination folder
			const folderContents = await vscode.workspace.fs.readDirectory(destFolderUri);
			const mdFiles = folderContents
				.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.md') && name !== indexFileName)
				.map(([name]) => name);

			// Sort files alphabetically to keep the index clean
			mdFiles.sort((a, b) => a.localeCompare(b));

			const indexLines = mdFiles.map(f => {
				const nameWithoutExt = f.replace(/\.md$/i, '');
				return `- [${nameWithoutExt}](./${f})`;
			});

			const startTag = '<!-- VSMemo Index Start -->';
			const endTag = '<!-- VSMemo Index End -->';
			const newSection = `${startTag}\n${indexLines.join('\n')}\n${endTag}`;

			let content = '';
			try {
				const fileBytes = await vscode.workspace.fs.readFile(indexUri);
				content = new TextDecoder('utf-8').decode(fileBytes);
			} catch {
				// Index file does not exist, which is fine. We will create it.
			}

			let newContent = '';
			const startIdx = content.indexOf(startTag);
			const endIdx = content.indexOf(endTag);

			if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
				// Replace managed section
				newContent = content.substring(0, startIdx) + newSection + content.substring(endIdx + endTag.length);
			} else {
				// Section doesn't exist or is invalid. Append to the end of the file.
				if (content.trim() === '') {
					newContent = newSection;
				} else {
					newContent = content.trimEnd() + '\n\n' + newSection + '\n';
				}
			}

			await vscode.workspace.fs.writeFile(indexUri, new TextEncoder().encode(newContent));
		} catch (error) {
			indexUpdateSuccess = false;
			vscode.window.showWarningMessage(`Auto Index Update failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Show completion messages
	if (failCount === 0) {
		const destName = selectedDest.name;
		if (successCount === 1) {
			if (fixedDestinationKey) {
				vscode.window.showInformationMessage('Archived current note.');
			} else {
				vscode.window.showInformationMessage(`Moved 1 file to "${destName}".`);
			}
		} else {
			vscode.window.showInformationMessage(`Moved ${successCount} files to "${destName}".`);
		}
	} else if (successCount > 0) {
		vscode.window.showWarningMessage(`Move partially failed. ${successCount} succeeded, ${failCount} failed.`);
	} else {
		vscode.window.showErrorMessage('Move failed. No files were moved.');
	}
}
