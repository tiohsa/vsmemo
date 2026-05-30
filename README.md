# VSMemo

VSMemo is a Visual Studio Code extension designed to streamline your Markdown note-taking and table editing experience. It allows you to quickly create date-stamped Markdown notes in your workspace using customized templates, manage complex Markdown tables with ease, and access all utilities from a dedicated sidebar.

## Features

- **Date Note Creation**: Easily spin up date-stamped Markdown notes with custom titles in a designated directory.
- **Date Note Templates**: Configure and use custom Markdown templates for your date notes with dynamic variables.
- **Dedicated Sidebar**: Access all VSMemo commands directly from the **VSMemo / Markdown Tools** sidebar in the Activity Bar.
- **Advanced Markdown Table Utilities**:
  - **Create Table**: Insert a Markdown table at the cursor with specified rows, columns, and optional headers.
  - **Edit Columns/Rows**: Insert and delete columns or rows at the cursor position.
  - **Convert Selection**: Transform delimited text (e.g., CSV, TSV) directly into a clean Markdown table.
- **Text Wrapping & Formatting**:
  - **Wrap in Code Block**: Wrap your selection in a code block with a specified language.
  - **Insert Today's Date**: Insert today's date in your preferred format.
  - **List Markdown Files**: Generate an index file listing all Markdown files in the current folder with links.
- **Move Selected Files**: Move one or more selected files from the VS Code Explorer context menu to preset destination folders without overwriting existing files. Supports `${workspaceFolder}`.

---

## Dedicated Sidebar

VSMemo adds a custom icon to your Activity Bar. Clicking it opens the **Markdown Tools** sidebar, which displays all available commands. Click any command in the sidebar to execute it immediately without having to open the Command Palette.

---

## Date Note Templates

VSMemo allows you to automate note creation using Markdown templates.

### How to use:
1. Create a directory for your templates (e.g. `.vsmemo/templates` in your workspace root).
2. Create Markdown template files (with `.md` extension) in that directory.
3. In your templates, you can use the following dynamic variables, which will be automatically replaced when the note is created:
   - `${title}`: The title you enter when prompted.
   - `${yyyy}`: Current year (4 digits, e.g., `2026`).
   - `${MM}`: Current month (2 digits, e.g., `05`).
   - `${dd}`: Current day (2 digits, e.g., `25`).
   - `${date}`: Today's date formatted according to the `vsmemo.dateFormat` setting.

### Example Template:
```markdown
# ${title}
Date: ${date}

## Overview
- Created on ${yyyy}-${MM}-${dd}

## Notes
- 
```

---

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) or open the **VSMemo** Sidebar.
2. Run or click one of the following commands:
   - **Create Date Note**: Prompts you for a title, lets you select a template, and creates a note file.
   - **Create Markdown Table at Position**: Insert a table at the cursor. You will be prompted for row/column count and header.
   - **Insert Markdown Table Column**: Inserts a new column at the cursor's column position.
   - **Insert Markdown Table Row**: Inserts a new row below/above the cursor's row position.
   - **Convert Selection to Markdown Table**: Converts selected delimited text into a Markdown table.
   - **Delete Markdown Table Column**: Deletes the column at the cursor.
   - **Delete Markdown Table Row**: Deletes the row at the cursor.
   - **Wrap Selection in Code Block**: Wraps selected text in a code block with a specified language (defaults to `mermaid`).
   - **Insert Today's Date**: Inserts today's date at the cursor.
   - **List Markdown Files in Directory**: Generates an index page linking all Markdown files in the current folder.
   - **Move to Preset Folder**: Move one or more selected files in the Explorer context menu to preset folders configured in settings.

---

## Extension Settings

This extension contributes the following settings:

* `vsmemo.createDirectory`: Path to the directory where notes will be created. Supports `${workspaceFolder}`.
  * Default: `${workspaceFolder}/notes`
* `vsmemo.fileNameFormat`: Name format for the note files.
  * Default: `${yyyy}-${MM}-${dd}_${title}.${ext}`
* `vsmemo.defaultCodeBlockLanguage`: Default language for wrapping code blocks.
  * Default: `mermaid`
* `vsmemo.dateFormat`: Date format used for `${date}` in templates and the "Insert Today's Date" command (date-fns format).
  * Default: `yyyy-MM-dd`
* `vsmemo.dateNoteTemplateDirectory`: Directory containing markdown templates. Supports `${workspaceFolder}`.
  * Default: `${workspaceFolder}/.vsmemo/templates`
* `vsmemo.dateNoteTemplateRequired`: If `true`, you must choose a template when creating a note (blank note option is disabled).
  * Default: `false`
* `vsmemo.moveDestinations`: Preset destination folders for moving selected files. Key: Display name, Value: Destination folder path. Supports `${workspaceFolder}`.
  * Default: `{"Inbox": "${workspaceFolder}/notes/inbox", "Archive": "${workspaceFolder}/notes/archive", "Done": "${workspaceFolder}/notes/done"}`

---

## Release Notes

### 0.1.0
- Added **Sidebar View** (`Markdown Tools`) in the activity bar for easier access to all commands.
- Added **Date Note Templates** feature to allow customized markdown templates for new notes.
- Supports template variable interpolation (`${title}`, `${yyyy}`, `${MM}`, `${dd}`, `${date}`).
- Added options to require template selection and specify template directory path.

### 0.0.1 (Unreleased)
- Initial release.
- Added "Create Date Note" command.
- Added Markdown table editing features.
- Added basic Markdown utilities (Code Block wrap, Date insertion, File list).

---

## Contributing

Feel free to open issues or pull requests on [GitHub](https://github.com/YourUserName/vsmemo).

## License

MIT
