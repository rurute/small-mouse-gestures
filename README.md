# small mouse gestures

マウスジェスチャ Chrome 拡張。ビルド工程を持たず、依存パッケージもゼロ。

## インストール（直接インストールする場合）

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選ぶ

## 既定のジェスチャ

右ボタンを押しながらドラッグする。

| ジェスチャ | 動作 |
|---|---|
| 左 | 戻る |
| 右 | 進む |
| 上 | ページ最上部へ |
| 下 | ページ最下部へ |
| 下 → 右 | タブを閉じる |
| 下 → 左 | 閉じたタブを復元 |

ロッカージェスチャ:

| 操作 | 動作 |
|---|---|
| 右ボタンを押しながら左クリック | 戻る |
| 左ボタンを押しながら右クリック | 進む |

ドラッグ中に ESC を押すとキャンセルされる。
割当は拡張のオプションページから変更できる。

## 動作しない場所

以下では Chrome がコンテンツスクリプトの実行を許可しないため、
どの拡張であってもジェスチャは動作しない。

- `chrome://` 系ページ、Chrome ウェブストア、PDF ビューア、他拡張のページ、新しいタブページ
- 埋め込み iframe の上で開始したジェスチャ（トップフレームのみに注入しているため）

## 対象プラットフォーム

Windows 版 Chrome。`contextmenu` イベントの発火タイミングが OS で異なるため、
macOS / Linux ではコンテキストメニューの抑止が正しく働かない。

## 開発

```bash
npm test          # ユニットテスト（Node 18 以上、依存パッケージなし）
```

コードを変更したら `chrome://extensions` で拡張をリロードする。
コンテンツスクリプトの変更は対象ページの再読み込みも必要。

リリース前に `test/manual-checklist.md` を通すこと。

## 配布用パッケージ

ウェブストアに提出する ZIP は次で作る。

```bash
python3 tools/package.py    # dist/small-mouse-gestures-<version>.zip
```

同梱するのは `manifest.json` と `icons/` と `src/` だけで、`docs/` や `test/` は入らない。
同梱物は `tools/package.py` の `INCLUDE` に許可リストとして書いてある。ファイルを増やして
配布物に含めたい場合は、ここも更新する（更新を忘れるとスクリプトが止まって気づける）。

manifest の参照先が欠けている、同じバージョンの ZIP がすでにある、といった場合は
ZIP を作らずに中断する。

## 構成

| ファイル | 役割 |
|---|---|
| `src/content/loader.js` | コンテンツスクリプトの入口。モジュール本体を動的 import する |
| `src/content/main.js` | イベント配線と副作用の適用 |
| `src/content/recognizer.js` | 点列 → 方向文字列（純粋関数） |
| `src/content/gesture-state.js` | ストロークとロッカーの状態機械（純粋ロジック） |
| `src/content/suppressor.js` | TTL 付きワンショット抑止フラグ（純粋ロジック） |
| `src/content/overlay.js` | 軌跡とラベルの描画 |
| `src/content/actions-content.js` | ページ内で完結するアクションの実装 |
| `src/shared/actions.js` | アクション定義の唯一の定義元 |
| `src/shared/settings.js` | 既定値・マージ・storage 連携 |
| `src/background/service-worker.js` | タブ操作（拡張 API が要るアクション） |
| `src/options/options.html` / `.css` / `.js` | 設定画面 |
| `src/options/gesture-symbol.js` | ジェスチャ → 軌跡の座標（純粋関数） |

不具合が出たときは、まず純粋ロジックの 3 つ（`recognizer.js` / `gesture-state.js` /
`suppressor.js`）のどれかを疑う。判断はここに閉じており、いずれもユニットテストが
あるので、再現するテストを 1 本足してから直す。

ブラウザでしか確認できない挙動は `test/manual-checklist.md` が受け持つ。

ウェブストアに提出する掲載文と権限の説明は `docs/store-listing.md` にまとめてある。
プライバシーポリシーは `PRIVACY.md`。

## ライセンス

MIT License. 詳細は [LICENSE](LICENSE) を参照。
