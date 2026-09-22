import * as path from 'path';

/** Keep the title readable while making it a portable filename component. */
export function sanitizeNoteTitle(title: string): string {
	const sanitized = title
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
		.trim()
		.replace(/\.+$/g, dots => '_'.repeat(dots.length));
	if (!sanitized) {
		throw new Error('Title must contain a filename character.');
	}
	const deviceName = sanitized.split('.')[0].replace(/[ .]+$/g, '');
	return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(deviceName) ? `_${sanitized}` : sanitized;
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
