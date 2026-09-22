import { resolveNoteFilePath } from './dateNoteFile';

export function validateMarkdownListFileName(fileName: string): string | undefined {
	if (!fileName.trim()) {
		return 'File name is required';
	}
	if (/[/\\:\x00]/.test(fileName)) {
		return 'File name must be a single filename without a path';
	}
	if (!fileName.endsWith('.md')) {
		return 'File name must end with .md';
	}
	return undefined;
}

export function resolveMarkdownListFilePath(directory: string, fileName: string): string {
	const error = validateMarkdownListFileName(fileName);
	if (error) {
		throw new Error(error);
	}
	return resolveNoteFilePath(directory, fileName);
}
