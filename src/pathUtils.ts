import * as path from 'path';
import * as vscode from 'vscode';

/** Choose the resource's workspace, or the only open workspace. */
export function getWorkspacePath(resource?: vscode.Uri): string | undefined {
	const containingFolder = resource && vscode.workspace.getWorkspaceFolder(resource);
	if (containingFolder) {
		return containingFolder.uri.fsPath;
	}
	const folders = vscode.workspace.workspaceFolders;
	return folders?.length === 1 ? folders[0].uri.fsPath : undefined;
}

/** Resolve a configured path only when its workspace context is unambiguous. */
export function resolveWorkspacePath(input: string, workspacePath: string | null | undefined = getWorkspacePath()): string {
	if (!input.includes('${workspaceFolder}') && path.isAbsolute(input)) {
		return path.normalize(input);
	}
	if (!workspacePath) {
		throw new Error(vscode.workspace.workspaceFolders?.length
			? 'Workspace path is ambiguous. Select a file in the intended workspace or configure an absolute path.'
			: 'No workspace folder is open');
	}
	return path.resolve(workspacePath, input.replace(/\$\{workspaceFolder\}/g, () => workspacePath));
}
