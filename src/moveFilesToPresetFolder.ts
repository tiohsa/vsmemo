import * as vscode from 'vscode';
import { moveCore } from './moveCore';

/**
 * Main command handler for moving selected files to a preset destination.
 * This is a thin wrapper delegating to Move Core.
 */
export async function moveFilesToPresetFolder(
	context: vscode.ExtensionContext,
	selectedUri?: vscode.Uri,
	allSelectedUris?: vscode.Uri[]
): Promise<void> {
	await moveCore({
		context,
		selectedUri,
		allSelectedUris
	});
}
