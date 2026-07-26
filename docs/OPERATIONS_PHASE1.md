# Phase1 本番セットアップ — 実行チェックリスト

コード／UIはデプロイ済みの前提で、**本番 DB・シード・実機確認**をこの順で進める。  
確定事項の正：[PHASE1_REDESIGN.md](./PHASE1_REDESIGN.md)

最終更新: 2026-07-25

## 実行ログ（2026-07-25）

| 項目 | 結果 |
|------|------|
| 1-A 原本リテンション列 | **済**（列は既に存在） |
| 1-B 川崎オン・逗子オフ | **済**（`JP-14-14130` supported / `JP-14-14208` unsupported） |
| 2-A 参照 URL seed | **済**（新規 0 / 更新 37） |
| 2-B Phase1 AI ルール | **済**（`ai_check_rules` に 15 件 insert・status=active） |
| 4 Cron 手動疎通 | **未完了** — 本番が 401。Vercel の `CRON_SECRET` と `.env.local` が不一致の可能性 |
| 3 施設アカウント・スモーク | **未実施**（ログイン操作は人手） |

---

## 0. 事前確認（5分）

- [x] 本番 URL を開く（例: https://mirucare.vercel.app ）
- [ ] サイドバーに「運用AI監査」「初期設定」があり、「法令／運営AI」が準備中であること（人手確認）
- [ ] Vercel 環境変数に `CRON_SECRET` があること（原本削除 Cron 用）※ローカルと一致させる
- [x] Supabase 本番プロジェクトへ接続できること
- [ ] 運営用ログイン（`/admin`）ができること（人手確認）

---

## 1. マイグレーション（必須）

Supabase **本番** → SQL Editor で、**この順**に実行する（未適用分）。

- `supabase/migrations/20260725060000_document_original_retention.sql`
- `supabase/migrations/20260725070000_phase1_kawasaki_jurisdiction.sql`
- `supabase/migrations/20260726050000_facility_announcements.sql`（事業所お知らせ投稿）

### 1-A. 原本リテンション列

ファイル: `supabase/migrations/20260725060000_document_original_retention.sql`

- [x] SQL を全文コピーして実行し、エラーなし（または既に適用済み）

確認クエリ（結果が 4 行であること）:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'documents'
  AND column_name IN (
    'keep_original_days',
    'retention_consent_at',
    'original_purge_after',
    'original_purged_at'
  )
ORDER BY column_name;
```

- [x] 上記 4 列が存在する

### 1-B. 川崎管轄（逗子を対象外）

ファイル: `supabase/migrations/20260725070000_phase1_kawasaki_jurisdiction.sql`

**前提**: `rule_jurisdictions`（ルールエンジン）が入っていること。未適用なら先に `20260720120000_rule_engine.sql` 系を適用する。

- [x] SQL を全文コピーして実行し、エラーなし（または既に適用済み）

確認クエリ:

```sql
-- 逗子はサポート外
SELECT code, name, is_supported
FROM public.rule_jurisdictions
WHERE code = 'JP-14-14208';

-- 川崎はサポート対象
SELECT code, name, is_supported
FROM public.rule_jurisdictions
WHERE code = 'JP-14-14130';
```

- [x] 逗子: `is_supported = false`
- [x] 川崎: `is_supported = true`

### 1-C. 施設お知らせ投稿列

ファイル: `supabase/migrations/20260726050000_facility_announcements.sql`

- [ ] SQL を実行し、エラーなし

確認:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_announcements'
  AND column_name IN ('organization_id', 'created_by');
```

- [ ] `organization_id` / `created_by` が存在する

---

## 2. シード（推奨）

ローカルの `.env.local` が **本番 Supabase** を向いているか確認してから実行する（誤って別環境に入れないこと）。

### 2-A. 参照 URL（任意・川崎含む）

```bash
npm run seed:rule-sources
```

- [x] エラーなく完了（2026-07-25: 更新 37 件）

### 2-B. Phase1 AI ルール（必須に近い）

**前提**: 訪問介護の監査項目テンプレートが `audit_items` に入っていること。

方法 A — 管理画面（推奨）:

1. `/admin/rules/ai-rules` を開く
2. 「Phase1ルール（1・3・7・8）を登録する」を押す

方法 B — CLI:

```bash
SEED_OPERATOR_PROFILE_ID=<あなたのprofiles.id> npm run seed:phase1-ai-rules
```

`profiles.id` は Supabase Table Editor の `profiles` か、ログイン中ユーザーの UUID。

- [x] シード成功（2026-07-25: inserted 15 / skipped 0 / missing []）
- [x] `ai_check_rules` に Phase1 15 コードが `active` で存在

---

## 3. 実機スモーク（施設アカウント）

本番にログインし、チェックする。

### 3-A. ナビ・IA

- [ ] 運用AI監査 / あとで確認 / 監査結果（お知らせは運用AI監査内）
- [ ] お知らせがあるとき、ナビ「運用AI監査」に件数バッジが出ること
- [ ] 運用AI監査に白枠でお知らせ／今日やること／最近の指摘（要改善以上・最大5件）
- [ ] 法令AI・運営AI は「準備中」
- [ ] 月末の確認・月次レポートが主导線に出ない
- [ ] ハンバーガーに「初期設定」「使い方」（設定・アップロードは無し）
- [ ] `/guide` に使い方要約と注意事項があること

### 3-B. 初期設定

- [ ] `/setup` で横浜・川崎・藤沢・鎌倉・茅ヶ崎が見える
- [ ] 管理者で自治体を保存できる

### 3-C. 運用AI・同意・結果

- [ ] 「書類をアップロードする」→ 同意チェックなしでは開始できない
- [ ] 「原本を最大7日間残す」はデフォルト OFF
- [ ] 同意して開始 → 結果の優先度が「緊急／要改善／推奨」
- [ ] 結果に匿名化の注意がある（可能なら氏名が「利用者A」等）

### 3-D. お知らせ・項目8

- [ ] 管理者は `/announcements` から事業所お知らせを投稿できる
- [ ] ルール更新お知らせも同じ一覧に出る
- [ ] `/billing-reconcile` で請求CSV突合（サーバに上がらない）

### 3-E. ルール絞り込み（任意・深い確認）

- [ ] 結果画面の適用ルール版が Phase1 寄り（`CHECK_RULES_SCOPE=all` でないこと）

### 3-F. DB

- [ ] `supabase/migrations/20260726050000_facility_announcements.sql` を本番に適用済み
---

## 4. Cron（任意だが本番では推奨）

Vercel Cron は日次 `0 16 * * *`（UTC＝JST 翌1:00）で `/api/cron/purge-document-originals` を叩く。

手動疎通:

```bash
curl -X POST "https://mirucare.vercel.app/api/cron/purge-document-originals" \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] 401 にならず、JSON で件数などが返る  
  ※ 2026-07-25: 本番は 401。Vercel Dashboard → Settings → Environment Variables で `CRON_SECRET` を `.env.local` と揃えて再デプロイ／再設定する。

---

## 5. 完了判定

次がすべて ○ なら Phase1 本番セットアップ完了。

| 項目 | OK |
|------|----|
| documents の原本保持 4 列 | ✓ |
| 川崎オン・逗子オフ | ✓ |
| Phase1 AI ルール投入 | ✓ |
| 同意 UI・優先度文言・項目8導線 | （人手スモーク待ち） |
| （任意）原本削除 Cron 疎通 | （`CRON_SECRET` 要同期） |

未決・後回し（本チェック外）:

- 層2処理用データの正確な TTL
- 7日期限切れの施設通知
- 「まもなくの期限」をナビに戻すか
- 運用AI項目 2・4・5・6・9

---

## トラブルシュート

| 症状 | 確認 |
|------|------|
| アップロード開始で DB エラー | 1-A の列が未作成の可能性 |
| 川崎が初期設定に出ない／ルール管轄がおかしい | 1-B 未実行、または rule_engine 未適用 |
| Phase1 シードで audit_item 不足 | 訪問介護テンプレート一括登録を先に実行 |
| Cron が 401 | Vercel の `CRON_SECRET` と Bearer が不一致 |
| UI が古い | ハードリロード。デプロイが最新か Vercel Dashboard で確認 |
