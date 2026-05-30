# VSMemo

VSMemo は、Markdown でのメモ作成やテーブル（表）編集の体験を効率化するために設計された Visual Studio Code 拡張機能です。ワークスペース内に日付スタンプ付きの Markdown メモをカスタムテンプレートを使用してすばやく作成したり、複雑な Markdown テーブルを簡単に管理したり、すべてのユーティリティに専用のサイドバーからアクセスしたりできます。

## 主な機能

- **日付メモの作成 (Date Note Creation)**: 指定したディレクトリに、現在のシステム日付とカスタムタイトルを含む日付スタンプ付きの Markdown メモファイルをすばやく作成します。
- **日付メモテンプレート (Date Note Templates)**: 動的変数を含むカスタム Markdown テンプレートを設定し、新しいメモ作成時に適用できます。
- **専用のサイドバー (Dedicated Sidebar)**: アクティビティバーにある **VSMemo / Markdown Tools** サイドバーから、すべての VSMemo コマンドに直接アクセスできます。
- **高度な Markdown テーブルユーティリティ**:
  - **テーブル作成 (Create Table)**: 行数、列数、ヘッダーの有無を指定して、カーソル位置に Markdown テーブルを挿入します。
  - **行・列の追加と削除 (Edit Columns/Rows)**: カーソル位置に対して列や行の挿入・削除を簡単に行えます。
  - **選択範囲の変換 (Convert Selection)**: カンマやタブなどの区切り文字で区切られたテキスト（CSV、TSVなど）を、きれいな Markdown テーブルに直接変換します。
- **テキストのラッピングとフォーマット**:
  - **コードブロックで囲む (Wrap in Code Block)**: 選択したテキストを指定したプログラミング言語のコードブロックで囲みます。
  - **今日の日付の挿入 (Insert Today's Date)**: 好みのフォーマットで今日の日付をカーソル位置に挿入します。
  - **ディレクトリ内の Markdown ファイル一覧化 (List Markdown Files)**: 現在のフォルダ内にあるすべての Markdown ファイルへのリンク一覧（インデックスファイル）を自動生成します。
- **ファイルのプリセットフォルダ移動 (Move Selected Files)**: エクスプローラーのコンテキストメニューから、選択した1つまたは複数のファイルを、設定された移動先フォルダへ上書きすることなく安全に移動します。`${workspaceFolder}` に対応しています。

---

## 専用サイドバー

VSMemo はアクティビティバーにカスタムアイコンを追加します。これをクリックすると **Markdown Tools** サイドバーが開き、利用可能なすべてのコマンドが一覧表示されます。サイドバー内のコマンドをクリックするだけで、コマンドパレットを開くことなく即座に実行できます。

---

## 日付メモテンプレート

VSMemo では、Markdown テンプレートを使用してメモの作成を自動化できます。

### 使用方法：
1. ワークスペース内にテンプレート用のディレクトリを作成します（例：ワークスペースのルート直下の `.vsmemo/templates`）。
2. そのディレクトリ内に Markdown 形式のテンプレートファイル（拡張子 `.md`）を作成します。
3. テンプレート内では、以下の動的変数を使用できます。これらはメモの作成時に自動的に置換されます。
   - `${title}`: メモ作成時に入力したタイトル。
   - `${yyyy}`: 現在の年（4桁、例: `2026`）。
   - `${MM}`: 現在の月（2桁、例: `05`）。
   - `${dd}`: 現在の日（2桁、例: `25`）。
   - `${date}`: `vsmemo.dateFormat` 設定に従ってフォーマットされた今日の日付。

### テンプレートの例：
```markdown
# ${title}
作成日: ${date}

## 概要
- 作成日: ${yyyy}年${MM}月${dd}日

## メモ
- 
```

---

## 使い方

1. コマンドパレット (`Ctrl+Shift+P` または `Cmd+Shift+P`) を開くか、**VSMemo** サイドバーを開きます。
2. 以下のコマンドを実行またはクリックします：
   - **Create Date Note (日付メモの作成)**: タイトルの入力を求められ、テンプレートを選択してメモファイルを作成します。
   - **Create Markdown Table at Position (テーブルの作成)**: カーソル位置にテーブルを挿入します。行数、列数、ヘッダーの有無を指定します。
   - **Insert Markdown Table Column (列の挿入)**: カーソルがある列の位置に新しい列を挿入します。
   - **Insert Markdown Table Row (行の挿入)**: カーソルがある行の下/上に新しい行を挿入します。
   - **Convert Selection to Markdown Table (選択範囲をテーブルに変換)**: 選択した区切りテキストを Markdown テーブルに変換します。
   - **Delete Markdown Table Column (列の削除)**: カーソル位置の列を削除します。
   - **Delete Markdown Table Row (行の削除)**: カーソル位置の行を削除します。
   - **Wrap Selection in Code Block (コードブロックで囲む)**: 選択したテキストを指定した言語のコードブロックで囲みます（デフォルトは `mermaid`）。
   - **Insert Today's Date (今日の日付を挿入)**: カーソル位置に今日の日付を挿入します。
   - **List Markdown Files in Directory (Markdownファイルの一覧表示)**: 現在のフォルダ内にあるすべての Markdown ファイルへのリンクを含むインデックスファイルを生成します。
   - **Move to Preset Folder (プリセットフォルダへの移動)**: エクスプローラーで選択したファイルを、設定されたプリセットフォルダから選択して移動します。

---

## 拡張機能の設定 (Settings)

この拡張機能は以下の設定を提供します：

* `vsmemo.createDirectory`: メモが作成されるディレクトリのパス。`${workspaceFolder}` をサポートしています。
  * デフォルト値: `${workspaceFolder}/notes`
* `vsmemo.fileNameFormat`: メモファイルのファイル名フォーマット。
  * デフォルト値: `${yyyy}-${MM}-${dd}_${title}.${ext}`
* `vsmemo.defaultCodeBlockLanguage`: コードブロックで囲む際のデフォルトの言語。
  * デフォルト値: `mermaid`
* `vsmemo.dateFormat`: テンプレートの `${date}` 変数および「今日の日付を挿入」コマンドで使用される日付フォーマット（date-fns 形式）。
  * デフォルト値: `yyyy-MM-dd`
* `vsmemo.dateNoteTemplateDirectory`: Markdown テンプレートが含まれるディレクトリのパス。`${workspaceFolder}` をサポートしています。
  * デフォルト値: `${workspaceFolder}/.vsmemo/templates`
* `vsmemo.dateNoteTemplateRequired`: `true` に設定すると、メモ作成時にテンプレートの選択が必須になります（空白メモの選択肢が無効になります）。
  * デフォルト値: `false`
* `vsmemo.moveDestinations`: 選択したファイルを移動するためのプリセット移動先フォルダ。キー：表示名、値：移動先フォルダパス。`${workspaceFolder}` をサポートしています。
  * デフォルト値: `{"Inbox": "${workspaceFolder}/notes/inbox", "Archive": "${workspaceFolder}/notes/archive", "Done": "${workspaceFolder}/notes/done"}`

---

## 更新履歴 (Release Notes)

### 0.1.0
- アクティビティバーに **サイドバービュー**（`Markdown Tools`）を追加し、すべてのコマンドへのアクセスを容易にしました。
- 新しいメモにカスタム Markdown テンプレートを適用できる **日付メモテンプレート** 機能を追加しました。
- テンプレート内の変数置換（`${title}`, `${yyyy}`, `${MM}`, `${dd}`, `${date}`）に対応しました。
- テンプレート選択の必須化オプション、およびテンプレートディレクトリのパス指定オプションを追加しました。

### 0.0.1 (未リリース)
- 初期リリース。
- 「日付メモの作成 (Create Date Note)」コマンドを追加。
- Markdown テーブルの編集機能を追加。
- 基本的な Markdown ユーティリティ（コードブロック囲み、日付挿入、ファイル一覧生成）を追加。

---

## 貢献について (Contributing)

バグ報告や機能提案、プルリクエストは [GitHub](https://github.com/YourUserName/vsmemo) でいつでも歓迎しています。

## ライセンス

MIT
