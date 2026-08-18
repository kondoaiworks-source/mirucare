# Dify チェック Workflow の入出力（check_type）

アプリは Workflow 変数を増やしません。既存の `document_text` / `approved_rules_json` / `regulatory_basis_json` / `check_as_of` 等のままです。  
**LLM ノードのシステムプロンプトと、出力 JSON の形だけを更新して再公開**してください。

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
