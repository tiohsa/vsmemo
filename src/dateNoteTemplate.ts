import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveWorkspacePath } from './pathUtils';

export interface DateNoteTemplateValues {
	title: string;
	yyyy: string;
	MM: string;
	dd: string;
	date: string;
}

export interface SelectedDateNoteTemplate {
	kind: 'blank' | 'template';
	templatePath?: string;
}

export interface DateNoteTemplateError extends Error {
	alreadyShown?: boolean;
}

interface DateNoteTemplateQuickPickItem extends vscode.QuickPickItem {
	selectionKind: 'blank' | 'template';
	templatePath?: string;
}


export async function selectDateNoteTemplate(
	config: vscode.WorkspaceConfiguration
): Promise<SelectedDateNoteTemplate | undefined> {
	const templateDirectory = resolveWorkspacePath(config.get<string>('dateNoteTemplateDirectory')!);
	const templateRequired = config.get<boolean>('dateNoteTemplateRequired', false);
	const items: DateNoteTemplateQuickPickItem[] = [];

	try {
		const files = await fs.promises.readdir(templateDirectory);
		const templateFiles = files
			.filter(file => file.toLowerCase().endsWith('.md'))
			.sort((a, b) => a.localeCompare(b));

		for (const file of templateFiles) {
			items.push({
				label: path.basename(file, path.extname(file)),
				selectionKind: 'template',
				templatePath: path.join(templateDirectory, file)
			});
		}
	} catch (err: unknown) {
		const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
		if (templateRequired && code === 'ENOENT') {
			vscode.window.showErrorMessage(`Failed to create note: template directory not found: ${templateDirectory}`);
			return undefined;
		}
		if (templateRequired) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(message);
		}
	}

	if (!templateRequired) {
		items.unshift({ label: 'Blank note', selectionKind: 'blank' });
	}

	const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a template' });
	if (!selected) {
		return undefined;
	}

	return selected.selectionKind === 'blank'
		? { kind: 'blank' }
		: { kind: 'template', templatePath: selected.templatePath };
}

export async function renderDateNoteTemplate(
	templatePath: string,
	values: DateNoteTemplateValues
): Promise<string> {
	let template: string;
	try {
		template = await fs.promises.readFile(templatePath, 'utf-8');
	} catch {
		vscode.window.showErrorMessage(`Failed to create note: failed to read template: ${templatePath}`);
		const error: DateNoteTemplateError = new Error('Template read failed');
		error.alreadyShown = true;
		throw error;
	}

	return replaceTemplateVariables(template, values);
}

export function replaceTemplateVariables(
	template: string,
	values: DateNoteTemplateValues
): string {
	return template.replace(/\$\{(title|yyyy|MM|dd|date)\}/g, (_match, key: keyof DateNoteTemplateValues) => values[key]);
}
