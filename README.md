# Word Search

OPFS + SQLite WASM を使ったオフライン対応の辞書検索 SPA。

## 技術スタック

- **UI**: React 19, vanilla CSS (BEM + CSS custom properties)
- **検索エンジン**: sql.js (SQLite WASM) on Web Worker
- **ストレージ**: Origin Private File System (OPFS)
- **ビルド**: Vite 8, TypeScript 6
- **テスト**: Vitest + Testing Library (unit), Playwright (E2E, Chromium only)
- **デプロイ**: Cloudflare Workers (Static Assets + R2)

## アーキテクチャ

```
worker/              Cloudflare Worker（R2 プロキシ + 静的アセット配信）
src/
├── shared/          型・定数（UI/Worker共有）
├── ui/              React コンポーネント + hooks
├── worker/          Web Worker（SQLite操作・OPFS管理）← ブラウザ側、CF Worker とは別物
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

| コマンド             | 説明                           |
| -------------------- | ------------------------------ |
| `npm run dev`        | 開発サーバー起動               |
| `npm run build`      | プロダクションビルド           |
| `npm run preview`    | ビルド結果プレビュー           |
| `npm run test`       | ユニットテスト実行             |
| `npm run test:watch` | ユニットテスト（watch モード） |
| `npm run e2e`        | E2E テスト実行                 |
| `npm run e2e:headed` | E2E テスト（ブラウザ表示）     |
| `npm run lint`       | ESLint 実行                    |
| `npm run deploy`     | Cloudflare Workers にデプロイ  |
| `npm run build:dict` | 辞書 DB ビルド                 |

## デプロイ

**Cloudflare Workers** (Static Assets) で SPA を配信し、**R2** の辞書データを同一オリジンでプロキシする。

### 前提

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) でアカウント作成
2. R2 バケットを作成（`wrangler.toml` の `bucket_name` と一致させる）
3. wrangler CLI でログイン:

```bash
npx wrangler login
```

### SPA デプロイ

```bash
npm run build
npm run deploy          # = wrangler deploy
```

### R2 (辞書データ)

```bash
# 1. 辞書ビルド
npm run build:dict

# 2. R2 にアップロード（meta.json + dict.db + ライセンス）
R2_BUCKET_NAME=word-search-dict bash scripts/upload-dict.sh dist-dict
```

GitHub Actions の "Upload Dictionary to R2" ワークフローでも実行可能（手動トリガー、要 `R2_BUCKET_NAME` Secret）。

### 辞書データの配信経路

```
Browser (Web Worker)
  → GET /dict.meta.json  → Cloudflare Worker → R2 (meta.json)   → Response + COOP/COEP
  → GET /dict.sqlite     → Cloudflare Worker → R2 (dict.db)     → Response + COOP/COEP
  → GET /assets/...      → Static Assets (dist/)                 → Response + _headers
```

1. SPA 起動時に Web Worker が `/dict.meta.json` を fetch
2. `meta.json` 内の `"url": "/dict.sqlite"` から辞書 DB を fetch
3. SHA-256 検証 → OPFS にキャッシュ（2回目以降はローカルから直接読み込み）

Cloudflare Worker がエッジキャッシュ + COOP/COEP ヘッダーを付与するため、R2 の CORS 設定やカスタムドメインは不要。

#### 開発時

`localDict` Vite プラグインが `dist-dict/` 内のファイルを同じパスで配信するため、開発と本番でコードの違いはない。

## COOP/COEP

OPFS と SharedArrayBuffer の利用に cross-origin isolation が必要。

- **開発/プレビュー**: `src/vite-plugins/coop-coep.ts` がヘッダーを付与
- **本番 (静的アセット)**: `public/_headers` (Workers Static Assets が適用)
- **本番 (R2 プロキシ)**: `worker/index.ts` が COOP/COEP ヘッダーを付与

## sql.js の注意点

- `sql-wasm-browser.js` (browser export) には `db.exec()` のバインドパラメータが動作しないバグがある。`vite.config.ts` の `resolve.alias` で `sql-wasm.js` を強制使用している
- WASM ファイルは `public/sql-wasm.wasm` に配置し、Worker から `/sql-wasm.wasm` で明示的にロードする
- LIMIT/OFFSET は sql.js ブラウザ版でバインドパラメータを使うと datatype mismatch になるため SQL 文字列に直接埋め込んでいる（`Math.trunc()` で整数化）
