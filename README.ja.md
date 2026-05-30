# VSMemo

VSMemo は、Markdown でのメモ作成やテーブル（表）編集の体験を効率化するために設計された Visual Studio Code 拡張機能です。ワークスペース内に日付スタンプ付きの Markdown メモをカスタムテンプレートを使用してすばやく作成したり、複雑な Markdown テーブルを簡単に管理したり、**ファイル整理機能スイート (File Organization Suite)** を使ってファイルを整理したり、すべてのユーティリティに専用のサイドバーからアクセスしたりできます。

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
- **ファイル整理機能スイート (File Organization Suite)**:
  - **プリセットフォルダへの移動 (Move Files to Preset)**: エクスプローラーのコンテキストメニューから、選択した1つまたは複数のファイルをプリセット移動先フォルダへ安全に移動。`${workspaceFolder}` をサポート。
  - **アクティブファイルのクイック移動 (Quick Move Current File)**: 現在開いているアクティブエディタのファイルを、QuickPickメニューから即座に移動。未保存ファイルの場合は保存ダイアログを表示し、Untitled（未保存の新規ファイル）の移動は安全のため防止。
  - **アクティブメモのアーカイブ (Archive Current Note)**: 設定されたアーカイブ用キーに基づいて、アクティブなドキュメントをワンクリックでアーカイブフォルダに直接移動。
  - **最近の移動先履歴 (Recent Destinations)**: 最近使用した移動先フォルダ（最大5件）を記憶し、移動先選択メニューの最上部に優先して表示。
  - **移動前の確認ダイアログ (Move Confirmation)**: 複数ファイルをまとめて移動する前に、移動先と対象ファイル件数・プレビューを確認するダイアログを表示（誤操作防止、1件のみ移動の場合はスキップ）。
  - **インデックスファイルの自動更新 (Auto Index Update)**: 移動が成功した際、移動先フォルダ内のインデックスファイル（デフォルト: `index.md`）を自動的に更新。ファイル内の `<!-- VSMemo Index Start -->` と `<!-- VSMemo Index End -->` の間を検出して、最新の Markdown リンク一覧に動的更新。

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
   - **VSMemo: Quick Move Current File (アクティブファイルのクイック移動)**: アクティブなドキュメントをプリセットフォルダへ移動します。
   - **VSMemo: Archive Current Note (アクティブメモのアーカイブ)**: アクティブなドキュメントを設定されたアーカイブフォルダへ直接移動します。
   - **VSMemo: Clear Recent Destinations (最近の移動先履歴のクリア)**: 最近使用した移動先フォルダの履歴をクリアします。

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
* `vsmemo.moveDestinations`: 選択したファイルを移動するためのプリセット移動先フォルダ. キー：表示名、値：移動先フォルダパス。`${workspaceFolder}` をサポートしています。
  * デフォルト値: `{"Inbox": "${workspaceFolder}/notes/inbox", "Archive": "${workspaceFolder}/notes/archive", "Done": "${workspaceFolder}/notes/done"}`
* `vsmemo.moveConfirmation.enabled`: 複数ファイル移動を実行する前に、確認ダイアログ（移動先フォルダと件数）を表示するかどうか。
  * デフォルト値: `true`
* `vsmemo.recentDestinations.enabled`: 最近使用した移動先フォルダをメニュー上部に優先表示するかどうか。
  * デフォルト値: `true`
* `vsmemo.recentDestinations.maxItems`: 履歴に保持する最近の移動先の最大件数。
  * デフォルト値: `5`
* `vsmemo.archiveDestinationKey`: 「アクティブメモのアーカイブ」コマンドで使用する、`vsmemo.moveDestinations` 内のキー名（例: `"Archive"`）。
  * デフォルト値: `null`
* `vsmemo.autoIndexUpdate.enabled`: `true` に設定すると、ファイル移動の成功後に移動先フォルダ内のインデックスファイルを自動的に更新します。
  * デフォルト値: `false`
* `vsmemo.autoIndexUpdate.fileName`: `vsmemo.autoIndexUpdate.enabled` が有効な際に自動更新されるインデックスファイルのファイル名。
  * デフォルト値: `"index.md"`

---

## 更新履歴 (Release Notes)

### 0.2.0
- **ファイル整理機能スイート (File Organization Suite)**:
  - アクティブなドキュメントを即座に移動する **Quick Move Current File (アクティブファイルのクイック移動)** コマンドを追加しました。
  - `vsmemo.archiveDestinationKey` に基づき、アクティブなドキュメントを直接アーカイブする **Archive Current Note (アクティブメモのアーカイブ)** コマンドを追加しました。
  - 最近使用した移動先を記録し、移動メニューの上部に優先表示する **最近の移動先履歴 (Recent Destinations)** 機能を追加しました。
  - 複数ファイル移動時の誤操作を防ぐための **移動前の確認ダイアログ (Move Confirmation Summary)** 機能を追加しました。
  - 移動が成功した際に、移動先フォルダ内のインデックスファイル（`index.md`など）を自動で最新のリンクに更新する **インデックス自動更新 (Auto Index Update)** 機能を追加しました（`<!-- VSMemo Index Start -->` と `<!-- VSMemo Index End -->` の範囲を自動検知して更新）。

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
