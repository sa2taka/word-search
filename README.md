# Word Search

OPFS + SQLite WASM を使ったオフライン対応の辞書検索 SPA。

## 技術スタック

- **UI**: React 19, vanilla CSS (BEM + CSS custom properties)
- **検索エンジン**: sql.js (SQLite WASM) on Web Worker
- **ストレージ**: Origin Private File System (OPFS)
- **ビルド**: Vite 8, TypeScript 6
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

正規化済みの `word` カラムを検索。4 つのモードに対応:

- **wildcard** (デフォルト): `?` で任意の1文字にマッチ（SQLite LIKE `_`）
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

SPA 本体は **Cloudflare Pages**、辞書データは **Cloudflare R2** にホストする。

### 前提

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) でアカウント作成
2. R2 バケットを作成（例: `word-search-dict`）
3. R2 バケットにカスタムドメインまたはパブリックアクセスを設定
4. wrangler CLI でログイン:

```bash
npx wrangler login
```

### Pages (SPA)

```bash
# ビルド → デプロイ
npm run build
npx wrangler pages deploy dist --project-name word-search
```

または Cloudflare Dashboard で GitHub 連携すれば main push で自動デプロイ:

| 設定 | 値 |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 22（環境変数 `NODE_VERSION=22`） |

### R2 (辞書データ)

```bash
# 1. 辞書ビルド
npm run build:dict

# 2. R2 にアップロード（meta.json + dict.db + ライセンス）
R2_BUCKET_NAME=<bucket> bash scripts/upload-dict.sh dist-dict
```

GitHub Actions 経由でも可能（手動トリガー）:

```bash
# リポジトリの Settings → Secrets に以下を設定:
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME
# Actions → "Upload Dictionary to R2" → Run workflow
```

### META_URL の設定

`src/shared/constants.ts` の `META_URL` が辞書メタデータの取得先。
開発時はローカルの `dist-dict/` から自動配信される（`localDict` Vite プラグイン）。
本番では R2 のパブリック URL を指定する。

## COOP/COEP

OPFS と SharedArrayBuffer の利用に cross-origin isolation が必要。

- **開発/プレビュー**: `src/vite-plugins/coop-coep.ts` がヘッダーを付与
- **本番**: `public/_headers` (Cloudflare Pages) で設定

## sql.js の注意点

- `sql-wasm-browser.js` (browser export) には `db.exec()` のバインドパラメータが動作しないバグがある。`vite.config.ts` の `resolve.alias` で `sql-wasm.js` を強制使用している
- WASM ファイルは `public/sql-wasm.wasm` に配置し、Worker から `/sql-wasm.wasm` で明示的にロードする
- LIMIT/OFFSET は sql.js ブラウザ版でバインドパラメータを使うと datatype mismatch になるため SQL 文字列に直接埋め込んでいる（`Math.trunc()` で整数化）
