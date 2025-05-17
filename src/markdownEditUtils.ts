import * as vscode from 'vscode';
import { format as formatDate } from 'date-fns';

export async function wrapCodeBlock(editor: vscode.TextEditor, language: string) {
    const selection = editor.selection;
    const text = editor.document.getText(selection.isEmpty ? editor.document.validateRange(new vscode.Range(0, 0, editor.document.lineCount, 0)) : selection);
    await editor.edit(editBuilder => {
        editBuilder.replace(selection, `\
\
${language}\n${text}\n\n`);
    });
}

export async function insertTodayDate(editor: vscode.TextEditor, format: string) {
    const now = new Date();
    const dateStr = formatDate(now, format);
    await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, dateStr);
    });
}

