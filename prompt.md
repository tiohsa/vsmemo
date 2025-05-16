
<指示>
あなたは最高のプログラマーでです。
VSCodeの拡張機能のコードに以下のmarkdownの編集機能を付けるのでコードの変更プランを考えてください。
</指示>

<制限条件>
- プランはステップバイステップで明確なタスクを作ってください
- typescriptを使う
- esbuildでビルドする
</制限条件>

<編集機能>
- 指定した行と列でmarkdownのテーブルを作成する機能
- カーソル位置にmarkdonwの列を挿入する機能
- カーソル位置にmarkdonwの行を挿入する機能
- 選択範囲の文字列の区切り文字を指定して、区切り文字をmarkdownのテーブルの区切り文字(|)に置き換えてテーブルを作成する機能
</編集機能>

<コード>

`package.json`

```json
{
  "name": "vsmemo",
  "displayName": "VSMemo",
  "description": "A VSCode extension that automatically generates date-stamped notes in your workspace.",
  "version": "0.0.1",
  "publisher": "YourPublisherName",
  "icon": "images/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/YourUserName/vsmemo.git"
  },
  "author": "Your Name <email@example.com>",
  "license": "MIT",
  "homepage": "https://github.com/YourUserName/vsmemo#readme",
  "engines": {
    "vscode": "^1.100.0"
  },
  "categories": [
    "Notes"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "vsmemo.createDateNote",
        "title": "Create Date Note"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "vsmemo.createDateNote",
          "title": "Create Date Note"
        }
      ]
    },
    "configuration": {
      "title": "VSMemo Settings",
      "properties": {
        "vsmemo.createDirectory": {
          "type": "string",
          "default": "${workspaceFolder}/notes",
          "description": "Absolute path or workspace-relative path to the directory where notes will be created"
        },
        "vsmemo.fileNameFormat": {
          "type": "string",
          "default": "${yyyy}-${MM}-${dd}_${title}.${ext}",
          "description": "Format for the file name. You can use ${yyyy}, ${MM}, ${dd}, ${title}, and ${ext}"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "pnpm run package",
    "compile": "pnpm run check-types && pnpm run lint && node esbuild.js",
    "watch": "pnpm run -p \"watch:*\"",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json",
    "package": "pnpm run check-types && pnpm run lint && node esbuild.js --production",
    "compile-tests": "tsc -p . --outDir out",
    "watch-tests": "tsc -p . -w --outDir out",
    "pretest": "pnpm run compile-tests && pnpm run compile && pnpm run lint",
    "check-types": "tsc --noEmit",
    "lint": "eslint src",
    "test": "pnpm run compile && pnpm run lint && pnpm run vscode:prepublish"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.10",
    "@types/node": "20.x",
    "@types/sinon": "^17.0.4",
    "@types/vscode": "^1.100.0",
    "@typescript-eslint/eslint-plugin": "^8.31.1",
    "@typescript-eslint/parser": "^8.31.1",
    "@vscode/test-cli": "^0.0.10",
    "@vscode/test-electron": "^2.5.2",
    "date-fns": "^3.6.0",
    "esbuild": "^0.25.3",
    "eslint": "^9.25.1",
    "npm-run-all": "^4.1.5",
    "sinon": "^20.0.0",
    "typescript": "^5.8.3"
  },
  "packageManager": "pnpm@10.11.0"
}
```

`extension.ts`

```ts
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

				const userTitle = await vscode.window.showInputBox({ prompt: 'Please enter a title' });
				if (!userTitle) {
					vscode.window.showErrorMessage('No title was entered');
					return;
				}

				let dirStat: fs.Stats | undefined;
				try {
					dirStat = await fs.promises.stat(dir);
				} catch (err: any) {
					// stat失敗時は常にmkdirを試みる（テスト仕様に合わせる）
					try {
						await fs.promises.mkdir(dir, { recursive: true });
					} catch (mkdirErr: any) {
						vscode.window.showErrorMessage('Failed to create note: ' + mkdirErr.message);
						return;
					}
				}

				// statが成功した場合はディレクトリかどうかをチェック
				if (dirStat && !dirStat.isDirectory()) {
					vscode.window.showErrorMessage(`Failed to create note: ${dir} exists but is not a directory`);
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

</コード>