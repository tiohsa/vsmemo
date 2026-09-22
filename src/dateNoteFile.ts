import * as path from 'path';

/** Keep the title readable while making it a portable filename component. */
export function sanitizeNoteTitle(title: string): string {
	const sanitized = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\./g, '_').trim();
	if (!sanitized) {
		throw new Error('Title must contain a filename character.');
	}
	return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(sanitized) ? `_${sanitized}` : sanitized;
}

/** Filename formats cannot escape the selected directory or introduce subdirectories. */
export function resolveNoteFilePath(directory: string, fileName: string): string {
	const root = path.resolve(directory);
	const target = path.resolve(root, fileName);
	const relative = path.relative(root, target);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)
		|| path.isAbsolute(relative) || /[/\\]/.test(fileName) || path.win32.isAbsolute(fileName)) {
		throw new Error('Note filename must stay inside the note directory.');
	}
	return target;
}
