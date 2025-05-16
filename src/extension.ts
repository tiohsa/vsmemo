// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { format as formatDate } from 'date-fns';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('vsmemo.createDateNote', async () => {
			try {
				const config = vscode.workspace.getConfiguration('vsmemo');
				let dir = config.get<string>('createDirectory')!;
				const format = config.get<string>('fileNameFormat')!;
				if (dir.includes('${workspaceFolder}')) {
					const folders = vscode.workspace.workspaceFolders;
					if (!folders || folders.length === 0) {
						vscode.window.showErrorMessage('No workspace folder is open');
						return;
					}
					dir = dir.replace('${workspaceFolder}', folders[0].uri.fsPath);
				}
				try {
					await fs.promises.stat(dir);
				} catch {
					await fs.promises.mkdir(dir, { recursive: true });
				}
				const userTitle = await vscode.window.showInputBox({ prompt: 'Please enter a title' });
				if (!userTitle) {
					vscode.window.showErrorMessage('No title was entered');
					return;
				}
				const userExt = 'md';
				const now = new Date();
				const fileName = format
					.replace(/\$\{yyyy\}/g, formatDate(now, 'yyyy'))
					.replace(/\$\{MM\}/g, formatDate(now, 'MM'))
					.replace(/\$\{dd\}/g, formatDate(now, 'dd'))
					.replace(/\$\{title\}/g, userTitle)
					.replace(/\$\{ext\}/g, userExt);

				const filePath = path.join(dir, fileName);
				await fs.promises.writeFile(filePath, '');
				const doc = await vscode.workspace.openTextDocument(filePath);
				await vscode.window.showTextDocument(doc);
			} catch (err: any) {
				vscode.window.showErrorMessage('Failed to create note: ' + err.message);
			}
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
