import * as vscode from 'vscode';

/**
 * Resolves ${workspaceFolder} variables in the input path.
 * If the path contains ${workspaceFolder}, it replaces it with the first workspace folder's path.
 * If no workspace folder is open, it throws an error.
 */
export function resolveWorkspacePath(input: string): string {
	if (!input.includes('${workspaceFolder}')) {
		return input;
	}

	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		throw new Error('No workspace folder is open');
	}

	return input.replace('${workspaceFolder}', folders[0].uri.fsPath);
}
