import * as vscode from 'vscode';

export class CommandItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly commandId: string,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: commandId,
            title: label,
            arguments: []
        };
        if (iconPath) {
            this.iconPath = iconPath;
        }
    }
}

export class SidebarProvider implements vscode.TreeDataProvider<CommandItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommandItem | undefined | void> = new vscode.EventEmitter<CommandItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CommandItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: CommandItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommandItem): Thenable<CommandItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        // コマンド一覧
        const commands = [
            { id: 'vsmemo.createDateNote', label: 'Create Date Note', icon: 'calendar' },
            { id: 'vsmemo.createTableAtPosition', label: 'Create Table', icon: 'table' },
            { id: 'vsmemo.insertColumn', label: 'Insert Column', icon: 'arrow-right' },
            { id: 'vsmemo.insertRow', label: 'Insert Row', icon: 'arrow-down' },
            { id: 'vsmemo.convertSelectionToTable', label: 'Convert Selection to Table', icon: 'symbol-key' },
            { id: 'vsmemo.deleteColumn', label: 'Delete Column', icon: 'remove' },
            { id: 'vsmemo.deleteRow', label: 'Delete Row', icon: 'remove' },
            { id: 'vsmemo.wrapCodeBlock', label: 'Wrap Code Block', icon: 'code' },
            { id: 'vsmemo.insertTodayDate', label: 'Insert Today Date', icon: 'calendar' },
            { id: 'vsmemo.listMarkdownFilesInDir', label: 'List Markdown Files', icon: 'list-unordered' },
        ];
        return Promise.resolve(commands.map(cmd => new CommandItem(cmd.label, cmd.id, new vscode.ThemeIcon(cmd.icon))));
    }
}
