# VSMemo

VSMemo is a Visual Studio Code extension that allows you to quickly create date-stamped Markdown notes in your workspace.

## Features

- Create a new note file with the current date and a custom title.
- The note file is created in a configurable directory within your workspace.
- The file name format is customizable (e.g., `${yyyy}-${MM}-${dd}_${title}.md`).

## Requirements

- Visual Studio Code v1.100.0 or later.

## Usage

1. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Run the command: **Create Date Note**.
3. Enter a title for your note.
4. A new Markdown file will be created in the configured directory with the current date and your title.

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
