# VSMemo

VSMemo is a Visual Studio Code extension that allows you to quickly create date-stamped Markdown notes in your workspace.

## Features

- Create a new note file with the current date and a custom title.
- The note file is created in a configurable directory within your workspace.
- The file name format is customizable (e.g., `${yyyy}-${MM}-${dd}_${title}.md`).
- **Create Markdown Table at Position**: Insert a Markdown table at the cursor with specified rows/columns.
- **Insert Markdown Table Column**: Insert a column into a Markdown table at the cursor position.
- **Insert Markdown Table Row**: Insert a row into a Markdown table at the cursor position.
- **Convert Selection to Markdown Table**: Convert selected text (with a delimiter) into a Markdown table.

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
3. Follow the prompts to complete the action.

## Extension Settings

This extension contributes the following settings:

- `vsmemo.createDirectory`: Absolute path or workspace-relative path to the directory where notes will be created. Default: `${workspaceFolder}/notes`
- `vsmemo.fileNameFormat`: Format for the file name. You can use `${yyyy}`, `${MM}`, `${dd}`, `${title}`, and `${ext}`. Default: `${yyyy}-${MM}-${dd}_${title}.${ext}`

## Known Issues

- None at this time.

## Release Notes

### 0.0.1

- Initial release: Create date-stamped notes with a custom title.

---

## Contributing

Feel free to open issues or pull requests on [GitHub](https://github.com/YourUserName/vsmemo).

## License

MIT

**Enjoy taking notes with VSMemo!**
