# VSMemo

VSMemo is a Visual Studio Code extension that allows you to quickly create date-stamped Markdown notes in your workspace.

## Features

- Create a new note file with the current date and a custom title.
- Customizable note creation directory and file name format (e.g., `${yyyy}-${MM}-${dd}_${title}.md`).
- **Create Markdown Table at Position**: Insert a Markdown table at the cursor with specified rows/columns.
- **Insert Markdown Table Column**: Insert a column into a Markdown table at the cursor position.
- **Insert Markdown Table Row**: Insert a row into a Markdown table at the cursor position.
- **Convert Selection to Markdown Table**: Convert selected text (with a delimiter) into a Markdown table.
- **Delete Markdown Table Column**: Delete the column at the cursor position in a Markdown table.
- **Delete Markdown Table Row**: Delete the row at the cursor position in a Markdown table.
- **Wrap Selection in Code Block**: Wrap the selected text in a code block with a specified language.
- **Insert Today's Date**: Insert today's date at the cursor position in a configurable format.
- **List Markdown Files in Directory**: Create a Markdown file listing all Markdown files in the current file's directory with links.

## Requirements

- Visual Studio Code v1.100.0 or later.


## Usage

1. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Run one of the following commands:
   - **Create Date Note**: Create a new date-stamped note.
   - **Create Markdown Table at Position**: Insert a Markdown table at the cursor. You will be prompted for row/column count and header.
   - **Insert Markdown Table Column**: Select a Markdown table, run this command, and specify the column index to insert.
   - **Insert Markdown Table Row**: Select a Markdown table, run this command, and specify the row index to insert.
   - **Convert Selection to Markdown Table**: Select delimited text, run this command, and specify the delimiter (e.g., comma, tab).   
   - **Delete Markdown Table Column**: Position the cursor within a Markdown table and run this command to delete the column.
   - **Delete Markdown Table Row**: Position the cursor within a Markdown table and run this command to delete the row.
   - **Wrap Selection in Code Block**: Select the text you want to wrap, run this command, and optionally specify the language.
   - **Insert Today's Date**: Run this command to insert today's date at the cursor.
   - **List Markdown Files in Directory**: Run this command to generate a list of Markdown files in the current directory.
3. Follow the prompts to complete the action.

## Extension Settings

This extension contributes the following settings:

- `vsmemo.createDirectory`: Absolute path or workspace-relative path to the directory where notes will be created.
  - Default: `${workspaceFolder}/notes`
- `vsmemo.fileNameFormat`: Format for the file name. You can use `${yyyy}`, `${MM}`, `${dd}`, `${title}`, and `${ext}`.
  - Default: `${yyyy}-${MM}-${dd}_${title}.${ext}`
- `vsmemo.defaultCodeBlockLanguage`: Default language for code blocks when wrapping selections.
  - Default: `mermaid`
- `vsmemo.dateFormat`: Format for inserting today's date (using date-fns format).
  - Default: `yyyy-MM-dd`

## Known Issues

- None at this time.

## Release Notes
### 0.0.1 (Unreleased)
- Initial release.
- Added "Create Date Note" command.
- Added Markdown table editing features:
  - Create Markdown Table at Position
  - Insert Markdown Table Column
  - Insert Markdown Table Row
  - Convert Selection to Markdown Table
  - Delete Markdown Table Column
  - Delete Markdown Table Row
- Added other Markdown editing utilities:
  - Wrap Selection in Code Block
  - Insert Today's Date
  - List Markdown Files in Directory

---

## Contributing

Feel free to open issues or pull requests on [GitHub](https://github.com/YourUserName/vsmemo).

## License

MIT

**Enjoy taking notes with VSMemo!**
