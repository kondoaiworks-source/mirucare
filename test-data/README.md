# シナリオ検証データ（CI外）

`テストケース_*.json`（11件）を Dify live で流し、目視レビュー用に findings を出力します。

```bash
npm run test:check:live
```

- 入力: `test-data/scenarios/`
- 出力: `test-data/scenarios-result.json`（gitignore）
- `.env.local` の `DIFY_API_KEY` 必須。スクリプト内で `DIFY_MOCK=0` を強制
- 連続実行で Knowledge base の rate limit に当たる場合は自動で指数バックオフ再試行する
- 調整例: `SCENARIO_DELAY_MS=30000 SCENARIO_RETRY_MS=60000 npm run test:check:live`

## Excel（.xlsx）からの投入

テンプレートと変換手順は [docs/excel-input-guide.md](../docs/excel-input-guide.md) を参照。

```bash
npm run generate:excel-template
cp test-data/templates/mirucare-template.xlsx test-data/input/sample.xlsx
npm run convert:excel
# → test-data/scenarios/converted-from-excel-sample.json
```
