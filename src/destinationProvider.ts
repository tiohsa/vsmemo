import * as path from 'path';
import * as vscode from 'vscode';
import { buildAutoRevealExclusionGlob } from './autoRevealExclude';
import { loadMoveDestinations } from './moveDestinations';
import { getWorkspacePath } from './pathUtils';

export class DestinationItem extends vscode.TreeItem {
	constructor(readonly destinationKey: string, rawPath: string, status: string, targetName?: string) {
		super(destinationKey, vscode.TreeItemCollapsibleState.None);
		this.id = `vsmemo.destination.${destinationKey}`;
		this.description = status;
		this.tooltip = `${destinationKey}: ${rawPath} (${status})${targetName ? `\n移動対象: ${targetName}` : ''}`;
		this.iconPath = new vscode.ThemeIcon('folder');
		this.contextValue = 'vsmemoDestination';
	}
}

export class DestinationProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private readonly changed = new vscode.EventEmitter<vscode.TreeItem | undefined>();
	readonly onDidChangeTreeData = this.changed.event;
	private resource: vscode.Uri | undefined;
	message = '移動対象: なし';

	setTarget(resource: vscode.Uri | undefined): void {
		this.resource = resource?.scheme === 'file' ? resource : undefined;
		this.message = this.resource ? `移動対象: ${path.basename(this.resource.fsPath)}` : '移動対象: なし';
		this.changed.fire(undefined);
	}

	refresh(): void { this.changed.fire(undefined); }
	getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }

	getChildren(): vscode.TreeItem[] {
		try {
			const resource = this.resource;
			const workspacePath = getWorkspacePath(resource);
			const destinations = loadMoveDestinations(resource, workspacePath);
			const excluded = vscode.workspace.getConfiguration('explorer').get<Record<string, boolean | object>>('autoRevealExclude', {});
			return destinations.map(destination => {
				const pattern = workspacePath && buildAutoRevealExclusionGlob(workspacePath, destination.resolvedPath);
				const rule = pattern ? excluded[pattern] : undefined;
				let status = workspacePath ? '対象外' : '要確認';
				if (pattern) { status = rule === true || (rule !== null && typeof rule === 'object') ? '除外設定あり' : '未設定'; }
				return new DestinationItem(destination.name, destination.rawPath, status, resource && path.basename(resource.fsPath));
			});
		} catch (error) {
			const item = new vscode.TreeItem('移動先を確認してください');
			item.description = '要確認';
			item.tooltip = error instanceof Error ? error.message : String(error);
			item.iconPath = new vscode.ThemeIcon('warning');
			return [item];
		}
	}

	dispose(): void { this.changed.dispose(); }
}
