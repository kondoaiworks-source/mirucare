# Dify チェック Workflow の入出力（check_type）

アプリは Workflow 変数を増やしません。既存の `document_text` / `approved_rules_json` / `regulatory_basis_json` / `check_as_of` 等のままです。  
**LLM ノードのシステムプロンプトと、出力 JSON の形だけを更新して再公開**してください。

**呼び出し回数の最適化**（Knowledge 条件分岐・キャッシュ等）は [dify-workflow-optimization.md](./dify-workflow-optimization.md) を参照。

## 現行 Workflow 構成（参考）

```
ユーザー入力 → [市町村検索 | 都道府県検索 | 全国検索]（並列）→ Gemini LLM（1ノード）→ 出力
```

- LLM は **1 ノード**（consistency / rule / severity は統合プロンプトで 1 回）
- 削減の主対象は **3 並列 Knowledge 検索**（`national` に応じた条件分岐で 1〜2 本に）

## 判定ルール（プロンプトに貼る）

```
あなたは介護事業所の書類Wチェック支援です。合否や返還は判定しません。
「〜の可能性があります」「〜をご確認ください」で書いてください。違反・不正・違法などの断定は禁止です。

まず各指摘を分類してください。

1. 書類同士・CSV同士の記載内容を比較して検出した不一致は
   check_type = "consistency"
   例: 同一時間帯のサービス重複、提供時間の不一致、日報にのみ存在する訪問、担当者名や日付の不一致。
   consistency は法令・行政資料を根拠に「違反」と表現しない。書類間の不整合・確認事項として扱う。

2. approved_rules_json または regulatory_basis_json の内容を根拠として、
   ルール・基準・記録要件との不適合可能性を検出した場合は
   check_type = "rule"

3. 根拠となる適用ルールを特定できない場合、
   単なる書類間の矛盾を rule として扱わず、consistency としてください。

4. rule の場合は、可能な限り rule_code、rule_version_id、rule_title、audit_item、check_as_of を返してください。
   推測だけで rule を付与しないでください。

5. 同じ事象を consistency と rule の両方で出すときは、根拠が違う場合のみ別指摘にしてください。
   同じ文言の重複は避けてください。

6. 読めない・点検不能なときは findings を空にし、
   meta.unreadable を true、model_notes に理由を書いてください。

7. Knowledge 検索結果（市区町村 / 都道府県 / 全国）のうち空のものは無視してください。
   ルール判定の主たる根拠は approved_rules_json と regulatory_basis_json です。
   KB コンテキストは補足資料として参照し、重複指摘は避けてください。
```

## 出力 JSON

`check_result`（または `result` / `text` 等）に、次の JSON 文字列を出してください。`check_type` は必須です。

```json
{
  "findings": [
    {
      "check_type": "consistency",
      "severity": "high",
      "title": "同一時間帯のサービス重複",
      "description": "同じ時間帯にサービスが重なっている可能性があります。ご確認ください。",
      "comparison": [
        { "source": "サービス提供記録", "detail": "2026/08/01 13:00～14:00" },
        { "source": "日報", "detail": "2026/08/01 13:30～14:30" }
      ],
      "suggestion": "両方の記録の開始・終了時刻を突き合わせてご確認ください。"
    },
    {
      "check_type": "rule",
      "rule_code": "RULE-XXX",
      "rule_version_id": "…",
      "rule_title": "利用者確認記録",
      "audit_item": "サービス提供記録",
      "check_as_of": "2026-08-18",
      "severity": "mid",
      "title": "利用者確認記録の不足",
      "description": "必須とされている確認欄が空欄の可能性があります。ご確認ください。",
      "basis": { "source_name": "適用ルール", "quote": "…" },
      "suggestion": "確認欄の記入をご確認ください。"
    }
  ]
}
```

`check_type` の許可値は `consistency` と `rule` のみです。

読めない場合:

```json
{ "findings": [], "meta": { "unreadable": true, "model_notes": "…" } }
```

## アプリ側の扱い

- `check_type` 欠落の過去結果は画面エラーにせず「分類未設定」
- 書類同士カタログ（計画日のずれ）はアプリが `consistency` を付ける
- `approved_rules_json` の各要素は `guidance`（優先箇所を残した本文）と `guidance_truncated`
- `national`: `"0"` = 自治体基準（市町村+都道府県 KB 推奨）/ `"1"` = 国基準（全国 KB のみ推奨）
- 1 チェック = API 1 回。Dify 内の KB/Gemini 呼び出し回数は [dify-workflow-optimization.md](./dify-workflow-optimization.md) で管理
