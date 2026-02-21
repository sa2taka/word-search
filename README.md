# Word Search

OPFS + SQLite WASM を使ったオフライン対応の辞書検索 SPA。

## 技術スタック

- **UI**: React 19, vanilla CSS (BEM + CSS custom properties)
- **検索エンジン**: sql.js (SQLite WASM) on Web Worker
- **ストレージ**: Origin Private File System (OPFS)
- **ビルド**: Vite 7, TypeScript 5.9
- **テスト**: Vitest + Testing Library (unit), Playwright (E2E, Chromium only)
- **デプロイ**: Cloudflare Pages (GitHub連携) + R2

## アーキテクチャ

```
src/
├── shared/          型・定数（UI/Worker共有）
├── ui/              React コンポーネント + hooks
├── worker/          Web Worker（SQLite操作・OPFS管理）
└── vite-plugins/    Viteプラグイン（COOP/COEPヘッダー）
```

UI と Worker は `postMessage` で型付きメッセージング通信を行う。Worker が SQLite DB のダウンロード・ハッシュ検証・OPFS 保存・検索クエリ実行を担当し、UI はリクエスト送信と結果表示に専念する。

### 検索

`surface`（見出し語）と `reading`（読み）の両方を検索対象とする。3 つのモードに対応:

- **contains**: 部分一致（LIKE）
- **prefix**: 前方一致（LIKE）
- **regex**: 正規表現（カスタム UDF, 2 秒タイムアウト）

## セットアップ

```bash
npm install
npx playwright install chromium  # E2Eテスト用
```

## コマンド

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド結果プレビュー |
| `npm run test` | ユニットテスト実行 |
| `npm run test:watch` | ユニットテスト（watch モード） |
| `npm run e2e` | E2E テスト実行 |
| `npm run e2e:headed` | E2E テスト（ブラウザ表示） |
| `npm run lint` | ESLint 実行 |

## デプロイ

### Pages (SPA)

Cloudflare Dashboard で GitHub リポジトリを連携。main push で自動ビルド＆デプロイ。

### R2 (辞書データ)

```bash
# ローカルから直接アップロード
R2_BUCKET_NAME=<bucket> bash scripts/upload-dict.sh dist-dict

# GitHub Actions (手動トリガー)
# Actions → "Upload Dictionary to R2" → Run workflow
```

## COOP/COEP

OPFS と SharedArrayBuffer の利用に cross-origin isolation が必要。

- **開発/プレビュー**: `src/vite-plugins/coop-coep.ts` がヘッダーを付与
- **本番**: `public/_headers` (Cloudflare Pages) で設定

## sql.js の注意点

- `sql-wasm-browser.js` (browser export) には `db.exec()` のバインドパラメータが動作しないバグがある。`vite.config.ts` の `resolve.alias` で `sql-wasm.js` を強制使用している
- WASM ファイルは `public/sql-wasm.wasm` に配置し、Worker から `/sql-wasm.wasm` で明示的にロードする
- LIMIT/OFFSET は sql.js ブラウザ版でバインドパラメータを使うと datatype mismatch になるため SQL 文字列に直接埋め込んでいる（`Math.trunc()` で整数化）
