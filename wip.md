# WIP Notes

## 変更内容

- 検索結果に対するローカル再ランキングの土台を追加
- Google Custom Search と Ollama を組み合わせる UI 側 hook を追加
- `common / known / obscure` のようなバッチ分類方向が有望という前提で調査

## 追加したもの

- `src/ui/hooks/useHybridRanking.ts`
- `src/ui/ranking/`
- テスト一式
- ベンチスクリプト
  - `scripts/bench/llm-comparator-bench.mjs`
  - `scripts/bench/ollama-batch-bench.mjs`

## ローカル環境メモ

- `ollama` を Homebrew でインストール
- 導入済みモデル
  - `qwen2.5:3b`
  - `qwen3:8b`
  - `llama3.2:3b`

## 計測メモ

### Comparator 方式

- `qwen2.5:3b`
  - 10語: 約 3.1s
  - 20語: 約 9.9s
- `llama3.2:3b`
  - 10語: 約 22.8s
  - 20語: 約 119.0s

### 100語バッチ分類

- `qwen2.5:3b`
  - 100語一括: 約 99.3s
  - 25語 x 4 分割: 約 86.9s

## 今後の方針案

- comparator sort は重いので、候補を絞った上でだけ使う
- 本線は `common / known / obscure` のバッチ分類
- Google 件数は補助特徴量として薄く混ぜる
