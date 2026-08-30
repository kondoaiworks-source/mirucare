# Excel（.xlsx）入力ガイド

介護ソフトや手入力の Excel を、監査のミカタのシナリオ JSON（Dify Workflow 投入用）に変換する手順です。

## 概要

| 項目 | 内容 |
|------|------|
| テンプレート | `test-data/templates/mirucare-template.xlsx` |
| 入力フォルダ | `test-data/input/*.xlsx` |
| 変換コマンド | `npm run convert:excel` |
| 出力 | `test-data/scenarios/converted-from-excel-*.json` |
| live 検証 | `npm run test:check:live` |

変換後の JSON は既存の `テストケース_*.json` と同じ構造（利用者情報・ケアプラン・サービス実績記録・請求データ・必要に応じてケアプラン_変更）です。`build-scenario-document-text` 経由で `document_text` になり、Dify に渡せます。

live 検証は `converted-from-excel-*.json` も対象です。Excel 変換分だけ試す例:

```bash
SCENARIO_FILTER=converted-from-excel npm run test:check:live
```

## シート構成（5シート必須）

### 1. ケアプラン

| 列 | 説明 |
|----|------|
| 利用者ID / 利用者名 / 生年月日 | 利用者識別 |
| プランID / 作成日 / 有効期間_開始 / 有効期間_終了 | 計画ヘッダ（行ごとに同じ値で可） |
| サービスNo / サービス名 / 頻度 / 実施時間 / 実施者資格 | **サービス内容は1行1サービス** |

### 2. 提供記録

| 列 | 説明 |
|----|------|
| 利用者ID / 実施日 / サービス名 | 必須相当 |
| 実施時間_開始 / 実施時間_終了 / 実施分数 | 開始・終了は `10:00` 形式。JSON では `10:00-10:30` に結合 |
| 実施者 / 実施者資格 / 実施内容 | 資格はシート5と氏名で突合して補完 |

### 3. 請求データ

| 列 | 説明 |
|----|------|
| 利用者ID / 請求年月 / サービス名 | 請求年月例: `2024年2月` |
| 請求回数 / 請求金額 / 請求区分 | 単価は 金額÷回数 で算出 |

### 4. 同意書

| 列 | 説明 |
|----|------|
| 利用者ID / 初回同意日 / 初回署名 | 初回は利用者情報に載せる |
| ケアプラン変更日 / 変更同意 / 変更署名 | **変更日があるときだけ** `ケアプラン_変更` を生成 |

変更時に同意がないケースは、変更同意・変更署名を「なし」にしてください（異常系の同意欠落テスト向け）。

### 5. 実施者資格

| 列 | 説明 |
|----|------|
| 実施者名 / 資格 / 資格確認日 / 資格証コピー確認 | 提供記録の実施者名と突合 |

`実施者資格一覧` として JSON に残り、document_text の提供記録パートにも追記されます。

## 手順

### 1. テンプレートを用意する

```bash
npm run generate:excel-template
# → test-data/templates/mirucare-template.xlsx
```

### 2. 入力 Excel を置く

```bash
cp test-data/templates/mirucare-template.xlsx test-data/input/sample.xlsx
# 必要に応じて Excel で編集
```

`npm run convert:excel` 実行時、`input/` が空ならテンプレートを `sample.xlsx` として自動コピーします。

### 3. JSON に変換する

```bash
npm run convert:excel
# → test-data/scenarios/converted-from-excel-sample.json
```

### 4. Dify live テスト

```bash
# .env.local に DIFY_API_KEY（DIFY_MOCK=0 はスクリプト側で強制）
npm run test:check:live
```

Excel 由来の JSON も `scenarios/` 配下の他ケースと一緒に実行されます。Excel 変換分だけ試す場合は、一時的に他の `テストケース_*.json` を退避するか、スクリプトの対象を絞ってください。

## 注意事項

- 本サービスは Wチェック支援です。変換結果や AI 指摘は合否・返還リスクの保証ではありません。
- Excel に実在の個人名を入れる場合は、社内ルールに従い取り扱ってください（ログには個人情報を出さない方針です）。
- シート名・列名はテンプレートどおりにしてください（列順は自由、列名一致が必要）。
- `.xlsx` のみ対応です（`.xls` は非対応）。

## 関連ファイル

- `scripts/convert-excel-to-json.ts` … 変換・テンプレート生成
- `src/lib/check/build-scenario-document-text.ts` … JSON → document_text
- `scripts/test-check-scenarios.ts` … live 検証
