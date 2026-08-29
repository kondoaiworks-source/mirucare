# Dify Workflow 呼び出し削減ガイド

MiruCare アプリは 1 チェックあたり `POST /v1/workflows/run` を **1 回**だけ呼びます。  
Gemini / Knowledge の呼び出し回数は **Dify Workflow グラフ**側で決まります。

本ドキュメントは Dify 管理画面での変更手順です。MiruCare の入力変数は **増やしません**。

## 現状の Workflow 構成

```
ユーザー入力
  ├─ 市町村検索 (kb_municipal) → 市区町村 ─┐
  ├─ 都道府県検索 (kb_prefecture) → 都道府県 ─┼→ Gemini LLM → 出力
  └─ 全国検索 (kb_national) → 全国 ─────────┘
```

| ノード | 種別 | 1 チェックあたり |
|--------|------|------------------|
| 市町村検索 | Knowledge | 常に 1 回 |
| 都道府県検索 | Knowledge | 常に 1 回 |
| 全国検索 | Knowledge | 常に 1 回 |
| Gemini LLM | LLM | 1 回 |

**推定合計**: Knowledge 3 + Gemini 1 = **4〜5 API 呼び出し**（KB 内部の embedding やリトライを含むと 5 回に見える場合あり）

**目標**: **2〜3 回**（KB 1〜2 + Gemini 1）

---

## Phase 0: 計測（変更前に必ず実施）

1. Dify → 対象 Workflow → **ログ**
2. 正常系で成功した実行を 1 件開く
3. 各ノードの実行有無・所要時間・トークンを記録

| ノード | 実行 | 時間 | トークン / 備考 |
|--------|------|------|-----------------|
| 市町村検索 | | | |
| 都道府県検索 | | | |
| 全国検索 | | | |
| Gemini LLM | | | |

---

## Phase 1: Knowledge 検索の条件分岐（P0・最大の削減）

### 背景

MiruCare は既に以下を Workflow に送っています。

- `national`: `"0"` = 自治体基準 / `"1"` = 国基準
- `municipality` / `prefecture`
- `approved_rules_json`（承認済みルールの guidance 全文）
- `regulatory_basis_json`

**常に 3 本の KB を並列実行する必要はありません。**

### 推奨分岐ロジック

| 条件 | 実行する KB | 削減 |
|------|-------------|------|
| `national == "1"` | **全国検索のみ** | -2 |
| `national == "0"` かつ `municipality` が空でない | **市町村 + 都道府県** | -1 |
| `municipality` が空 | **都道府県 + 全国** | -1 |

live シナリオ（横浜市・`national=0`）では **市町村 + 都道府県** の 2 本で足りる想定です。

### Dify での実装手順

#### 1. If/Else ノードを追加

Start（ユーザー入力）の直後に **条件分岐** ノードを置く。

**条件 A（国基準）**

```
{{#if national == "1"}}
  → 全国検索 のみ → テンプレート → LLM
{{/if}}
```

Dify UI では:

- 条件: `national` equals `1`
- True 枝: 全国検索 → 全国テンプレート →（下記マージへ）
- False 枝: 次の分岐へ

**条件 B（自治体あり）**

```
{{#else if municipality が空でない}}
  → 市町村検索 → 都道府県検索 → テンプレート統合 → LLM
{{/else}}
```

- 条件: `municipality` is not empty
- True 枝: 市町村検索 + 都道府県検索

**条件 C（フォールバック）**

```
{{#else}}
  → 都道府県検索 + 全国検索 → LLM
{{/else}}
```

#### 2. 未実行枝の空埋め

スキップした KB のテンプレート変数は **空文字** にする。

- Code ノードまたは Variable Assigner で:
  - `kb_municipal_context = ""`
  - `kb_prefecture_context = ""`
  - `kb_national_context = ""`

LLM プロンプト側で「空の KB コンテキストは無視する」と指示（[dify-check-workflow.md](./dify-check-workflow.md) 参照）。

#### 3. テンプレートを 1 変数にマージ（推奨）

3 つのテンプレート（市区町村 / 都道府県 / 全国）を **1 つの `regulatory_context`** にまとめてから LLM へ渡すと、プロンプトが簡潔になります。

```
## 市区町村の根拠資料
{{kb_municipal_context}}

## 都道府県の根拠資料
{{kb_prefecture_context}}

## 全国の根拠資料
{{kb_national_context}}
```

#### 4. 再公開

Workflow を **公開** し、MiruCare から 1 件テスト実行。ログで KB ノードの実行数が減っていることを確認。

---

## Phase 2: KB と approved_rules_json の重複見直し（P1）

### 確認事項

1. `kb_municipal` 等の内容は、MiruCare の `approved_rules_json` と **同じソース**か
2. KB が **条例・行政資料の追加補完**をしているか、**重複取得**か

### オプション

| 方針 | 効果 | リスク |
|------|------|--------|
| A. KB 3 本 → metadata フィルタで 1 本統合 | 検索 3→1 | KB 再設計が必要 |
| B. KB 廃止、`approved_rules_json` のみ | 検索 3→0 | 条例ベース指摘の低下 |
| C. Phase 1 の条件分岐のみ | 検索 3→1〜2 | 変更が小さい（推奨・まずここ） |

**判断は live 11 ケース**（`npm run test:check:live`）の検出率で行う。退行があれば Phase 1 に戻す。

---

## Phase 3: Gemini LLM キャッシュ（P1）

### キャッシュキー

`document_text` だけでは不十分です。以下を含めてください。

```
hash(
  document_text
  + approved_rules_json
  + regulatory_basis_json
  + check_as_of
  + doc_type
  + national
)
```

### Dify での設定

1. LLM ノード（Gemini）を開く
2. キャッシュ / Prompt Cache があれば **有効化**（プラン・バージョンによる）
3. 可能なら Code ノードで上記 `cache_key` を生成し LLM に渡す

### 確認

同一書類を 2 回チェックし、2 回目の Gemini トークンが 0 または大幅減少すること。

---

## Phase 4: unreadable 時の LLM スキップ（P2）

Start 直後に If/Else を追加:

| 条件 | 動作 |
|------|------|
| `document_text` が空 **かつ** `document_image` なし | 固定 JSON を出力ノードへ（LLM・KB をスキップ） |

固定 JSON:

```json
{ "findings": [], "meta": { "unreadable": true, "model_notes": "document_text and image are empty" } }
```

MiruCare 側でも [`shouldSkipDifyForExtract`](../src/lib/check/extract.ts) が Workflow 呼び出し自体をスキップします（二重防御）。

---

## Phase 5: 検証

### Dify ログ

- KB 実行数が 1〜2 に減っていること
- Gemini が 1 回であること
- `knowledge base request rate limit` が出にくくなっていること

### MiruCare live シナリオ

```bash
cd /path/to/MiruCare
npm run test:check:live 2>&1 | tee /tmp/scenario-live.log
```

- `test-data/scenarios-result.json` で `parseOk` / `findingCount` の退行なし
- PluginInvokeError がある場合: `grep -A20 "plugin_invoke_error" /tmp/scenario-live.log`

### 単体テスト

```bash
npm test -- --run src/lib/dify/
```

---

## 目標呼び出し回数

| シナリオ | Before | After（目標） |
|----------|--------|---------------|
| 横浜市・自治体基準（national=0） | 3 KB + 1 Gemini | **2 KB + 1 Gemini = 3** |
| 国基準（national=1） | 3 KB + 1 Gemini | **1 KB + 1 Gemini = 2** |
| 同一書類の再チェック | 同上 | **0〜1 Gemini**（キャッシュ） |

---

## 変更しないもの

- MiruCare の Workflow 入力変数（増やさない）
- `retry` / `fallback` ロジック（[`client.ts`](../src/lib/dify/client.ts)）
- `scenarios-result.json` の出力仕様
- 出力 JSON スキーマ（[dify-check-workflow.md](./dify-check-workflow.md)）

---

## 関連ドキュメント

- [dify-check-workflow.md](./dify-check-workflow.md) — プロンプト・出力 JSON・check_type
- [README.md](../README.md) — STEP 4 Dify 接続・live シナリオ
