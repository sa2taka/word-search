# CLAUDE.md

## プロジェクト概要

OPFS + SQLite WASM によるオフライン対応辞書検索 SPA。
UI (React) と検索エンジン (Web Worker + sql.js) が `postMessage` で通信する。

## コマンド

```bash
npm run dev          # 開発サーバー (port 5173)
npm run build        # プロダクションビルド
npm run test         # ユニットテスト (Vitest, 88件)
npm run test:watch   # ユニットテスト watch
npm run e2e          # E2Eテスト (Playwright Chromium, 20件)
npm run e2e:headed   # E2E ブラウザ表示
npm run lint         # ESLint
```

## ディレクトリ構造

```
src/shared/       型・定数（UI/Worker共有、他に依存しない）
src/ui/           Reactコンポーネント + hooks + CSS
src/worker/       Web Worker層（SQLite操作、OPFS、検索実行）
src/vite-plugins/ Viteプラグイン（COOP/COEPヘッダー）
e2e/              Playwright E2Eテスト
  fixtures/       テストDBデータ生成
  helpers/        共通ヘルパー（モックルート）
public/           静的ファイル（sql-wasm.wasm, _headers）
```

## アーキテクチャ

### Worker ↔ UI 通信

- `WorkerRequest` / `WorkerResponse` (union types in `src/shared/types.ts`)
- SEARCH リクエストには `requestId` (UUID) を付与し、レスポンスと照合
- `useSearchWorker` フックが Worker ライフサイクルを管理

### DB ライフサイクル

1. `INIT` → meta.json 取得 → DB ダウンロード → SHA-256 検証 → OPFS 保存 → sql.js で open
2. ローカル版がありバージョン一致なら OPFS から直接 open
3. meta 取得失敗時もローカル版があればフォールバック

### 検索

`surface` と `reading` の両方を OR 条件で検索。バインドパラメータは `[lang, pattern, pattern]` の 3 つ。

モード: `contains` (部分一致), `prefix` (前方一致), `regex` (正規表現 UDF, 2秒タイムアウト)

## 重要な技術的制約

### sql.js ブラウザ版の問題

- `sql-wasm-browser.js` の `db.exec()` でバインドパラメータが機能しない → `resolve.alias` で `sql-wasm.js` を強制
- LIMIT/OFFSET をバインドパラメータにすると datatype mismatch → SQL 文字列に `Math.trunc()` で埋め込み
- WASM は `public/sql-wasm.wasm` に配置、Worker から `/sql-wasm.wasm` で明示ロード

### COOP/COEP

OPFS に必要。dev/preview は Vite プラグイン、本番は `public/_headers` で設定。

### E2E テスト

- `vite preview` (プロダクションビルド) に対して実行。dev サーバーでは React StrictMode の Worker 二重生成で不安定
- `page.route()` で `dict.meta.json` / `dict.sqlite` をインターセプトしテスト用 DB を返す
- Chromium 限定（OPFS サポート）

## テスト方針

- ユニットテスト: Vitest + jsdom + Testing Library
- E2E: Playwright (Chromium)
- テストは仕様をテストし、実装をテストしない
- AAA パターン (Arrange → Act → Assert)
- 1 テスト = 1 関心事

## コーディング規約

- CSS: バニラ CSS + BEM + CSS custom properties (`src/ui/styles/theme.css`)
- 関数型アプローチ優先、早期リターン、小さな関数
- Worker 層は依存注入パターン (`createDbManager(deps)`)
- エラーは `WorkerError` (code + message) で型安全に伝播
