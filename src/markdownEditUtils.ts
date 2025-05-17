import * as vscode from 'vscode';
import { format as formatDate } from 'date-fns';

export async function wrapCodeBlock(editor: vscode.TextEditor, language: string) {
    const { selection, document } = editor;
    const text = selection.isEmpty ? "\n" : document.getText(selection);
    const newText = `\`\`\`${language}\n${text}\`\`\`\n`;
    await editor.edit(editBuilder => {
        editBuilder.replace(selection.isEmpty ? selection.active : selection, newText);
    });
}

export async function insertTodayDate(editor: vscode.TextEditor, format: string) {
    const now = new Date();
    const dateStr = formatDate(now, format);
    await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, dateStr);
    });
}
