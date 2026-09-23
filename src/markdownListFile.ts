import { resolveNoteFilePath } from './dateNoteFile';

export function validateMarkdownListFileName(fileName: string): string | undefined {
	if (!fileName.trim()) {
		return 'File name is required';
	}
	if (/[<>:"/\\|?*\x00-\x1f]/.test(fileName)) {
		return 'File name must be a single filename without a path';
	}
	if (/[. ]$/.test(fileName) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(fileName)) {
		return 'File name is reserved or ends with a dot or space';
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
