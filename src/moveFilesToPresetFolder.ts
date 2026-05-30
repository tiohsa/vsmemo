import * as path from 'path';
import * as vscode from 'vscode';
import { loadMoveDestinations, MoveDestination } from './moveDestinations';

/**
 * Main command handler for moving selected files to a preset destination.
 */
export async function moveFilesToPresetFolder(
	selectedUri?: vscode.Uri,
	allSelectedUris?: vscode.Uri[]
): Promise<void> {
	// Normalize selected resources
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

	// PC-01: At least one file is selected
	if (uris.length === 0) {
		return;
	}

	// PC-02: All selected resources use a supported file system scheme
	for (const uri of uris) {
		if (uri.scheme !== 'file') {
			vscode.window.showErrorMessage('Move cancelled. Unsupported URI scheme.');
			return;
		}
	}

	// PC-03: All selected resources are files (not folders)
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

	// PC-04: Load and validate move destination settings
	let destinations: MoveDestination[];
	try {
		destinations = loadMoveDestinations();
	} catch (error) {
		vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
		return;
	}

	// Show QuickPick to user
	const items: vscode.QuickPickItem[] = destinations.map(d => ({
		label: d.name,
		description: d.rawPath
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select a destination folder'
	});

	// FR-11: If the user cancels destination selection, no file operation is performed
	if (!selected) {
		return;
	}

	const destination = destinations.find(d => d.name === selected.label)!;
	const destFolderUri = vscode.Uri.file(destination.resolvedPath);

	// PC-06: Destination is not an existing file
	try {
		const destStat = await vscode.workspace.fs.stat(destFolderUri);
		if ((destStat.type & vscode.FileType.File) !== 0) {
			vscode.window.showErrorMessage(`Move cancelled. Destination path is a file, not a folder: ${destination.resolvedPath}`);
			return;
		}
	} catch {
		// Folder doesn't exist, which is fine (we will create it)
	}

	// Analyze conflict and same path checks
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

		// PC-08: No destination file conflicts exist
		try {
			await vscode.workspace.fs.stat(targetUri);
			conflicts.push(filename);
		} catch {
			// File does not exist in destination, no conflict
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

	// PC-07: Create the destination folder if it does not exist
	try {
		await vscode.workspace.fs.createDirectory(destFolderUri);
	} catch (error) {
		vscode.window.showErrorMessage(`Move cancelled. Failed to create destination folder: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}

	// Execute file moves
	let successCount = 0;
	let failCount = 0;

	for (const move of moves) {
		try {
			await vscode.workspace.fs.rename(move.source, move.target, { overwrite: false });
			successCount++;
		} catch {
			failCount++;
		}
	}

	// Show completion messages
	if (failCount === 0) {
		if (successCount === 1) {
			vscode.window.showInformationMessage(`Moved 1 file to "${destination.name}".`);
		} else {
			vscode.window.showInformationMessage(`Moved ${successCount} files to "${destination.name}".`);
		}
	} else if (successCount > 0) {
		vscode.window.showWarningMessage(`Move partially failed. ${successCount} succeeded, ${failCount} failed.`);
	} else {
		vscode.window.showErrorMessage('Move failed. No files were moved.');
	}
}
