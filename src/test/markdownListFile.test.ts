import assert from 'assert';
import * as path from 'path';
import { resolveMarkdownListFilePath, validateMarkdownListFileName } from '../markdownListFile';

suite('Markdown list output filename', () => {
	test('accepts Markdown filenames and resolves them within the selected directory', () => {
		const directory = path.resolve('notes');
		for (const fileName of ['markdown_files_list.md', 'meeting.v2.md', '日本語 notes.md']) {
			assert.strictEqual(validateMarkdownListFileName(fileName), undefined);
			assert.strictEqual(resolveMarkdownListFilePath(directory, fileName), path.join(directory, fileName));
		}
	});

	test('rejects empty names, paths, traversal, absolute paths and non-Markdown names', () => {
		for (const fileName of [
			'', '   ', '.', '..', '../README.md', '../../outside.md', 'nested/index.md',
			'nested\\index.md', '/absolute.md', 'C:\\outside.md', 'C:outside.md',
			'\\\\server\\share\\outside.md', 'notes.txt', 'notes.MD', 'bad\0.md'
		]) {
			assert.notStrictEqual(validateMarkdownListFileName(fileName), undefined, fileName);
			assert.throws(() => resolveMarkdownListFilePath(path.resolve('notes'), fileName), fileName);
		}
	});
});
