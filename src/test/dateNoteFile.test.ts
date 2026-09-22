import * as assert from 'assert';
import * as path from 'path';
import { resolveNoteFilePath, sanitizeNoteTitle } from '../dateNoteFile';

suite('Date note filenames', () => {
	for (const [input, expected] of [
		['日本語のメモ', '日本語のメモ'], ['café 🎉', 'café 🎉'],
		['../escape', '___escape'], ['..\\escape', '___escape'],
		['<>:"/\\|?*', '_________'], ['.', '_'], ['..', '__'],
		['trailing.  ', 'trailing_'], ['CON', '_CON'], ['report', 'report']
	]) {
		test(`sanitizes ${JSON.stringify(input)} as one filename component`, () => {
			assert.strictEqual(sanitizeNoteTitle(input), expected);
		});
	}
	test('rejects a title containing only spaces', () => {
		assert.throws(() => sanitizeNoteTitle('   '), /Title/);
	});
	test('accepts a note directly inside the destination', () => {
		assert.strictEqual(resolveNoteFilePath('/notes', '日本語.md'), path.resolve('/notes/日本語.md'));
	});
	for (const filename of ['../escape.md', '/outside.md', '..\\escape.md', 'nested/note.md', 'C:\\outside.md', '..', '']) {
		test(`rejects an unsafe filename ${JSON.stringify(filename)}`, () => {
			assert.throws(() => resolveNoteFilePath('/notes', filename), /inside the note directory/);
		});
	}
});
