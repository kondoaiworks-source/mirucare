# Step 3 本番設定手順（変更検知 → AI整理 → 承認 → 反映）

この文書は、**行政マニュアルの差分を検知し、AIで整理して人間が承認する機能**を本番で動かすために、Vercel と Supabase に設定する項目をまとめたものです。

専門知識がなくても上から順に進められるように書いています。

---

## いま何をする機能か（1分で）

1. 毎日の自動チェックで、公式PDFの中身が変わったかを検知する  
2. 変わっていたら AI（Gemini）が「どこが変わったか」を整理する  
3. 運営のメールに「確認してください」と通知する  
4. 管理画面で人が確認して「承認」すると、施設向けお知らせに反映される  

**まだ設定が足りなくても、システム全体が止まることはありません。**  
ただし「メールが届かない」「AI整理が付かない」などの制限が出ます（下表）。

---

## 本番に必要な設定一覧

| 設定 | どこに入れるか | 未設定のとき |
|------|----------------|--------------|
| `CRON_SECRET` | Vercel Production | 毎日の自動同期が **毎回失敗（401）** |
| `GEMINI_API_KEY` | Vercel Production | 変更は検知するが **AI整理なし** の承認待ちになる |
| `GEMINI_MODEL` | 任意（既定で可） | 既定 `gemini-2.5-pro` を使用 |
| `RESEND_API_KEY` | Vercel Production | 通知メールが送れない（ログのみ・処理は継続） |
| `RESEND_FROM_EMAIL` | Vercel Production | キーがあっても送信元が不正だと失敗しやすい |
| `OPERATOR_EMAILS` | Vercel Production | マニュアル個別の通知先が無いとき、フォールバック先が無い |
| Storage `knowledge-snapshots` | Supabase | テキスト保存に失敗 → AI整理なし／要確認ドラフト |

あわせて **Supabase にマイグレーション**  
`supabase/migrations/20260719080000_knowledge_change_drafts.sql` を適用してください。

---

## 1. Supabase：マイグレーションと Storage

### 1-1. SQL を実行する

1. [Supabase Dashboard](https://supabase.com/dashboard) を開く  
2. 本番プロジェクトを選ぶ  
3. 左メニュー **SQL Editor**  
4. `supabase/migrations/20260719080000_knowledge_change_drafts.sql` の内容をすべて貼り付けて **Run**

成功すると次ができます。

- テーブル: `knowledge_document_snapshots` / `knowledge_document_change_drafts` / `knowledge_document_versions`  
- 列: `knowledge_documents.notify_emails`  
- バケット: `knowledge-snapshots`（private）

### 1-2. Storage バケットの確認

1. 左メニュー **Storage**  
2. **`knowledge-snapshots`** があること  
3. **Public になっていないこと**（private）  

マイグレーションでバケット作成まで行う想定です。一覧に無い場合は、同名で **private** バケットを手動作成し、許可 MIME に `text/plain` を含めてください。

### 1-3. 既存マニュアルの初回スナップショット（推奨）

すでに台帳にマニュアルがある場合、差分比較用の「変更前」テキストが無いことがあります。

ローカルで `.env.local` に本番と同じ Supabase キーを入れたうえで:

```bash
npm run backfill:knowledge-snapshots
```

（公的サイトへの連続アクセスがあるため、件数が多い場合は時間を置いて実行してください）

---

## 2. Gemini API キー（AI差分整理）

### 2-1. キーの取得

1. [Google AI Studio](https://aistudio.google.com/apikey) を開く  
2. Google アカウントでログイン  
3. **Create API key** でキーを発行  
4. キー文字列をメモ（チャットや Git に貼らない）

### 2-2. Vercel へ設定

1. [Vercel Dashboard](https://vercel.com) → プロジェクト（本番）  
2. **Settings** → **Environment Variables**  
3. Production に追加:

| Name | Value | 備考 |
|------|--------|------|
| `GEMINI_API_KEY` | （発行したキー） | 必須 |
| `GEMINI_MODEL` | `gemini-2.5-pro` | 省略可。上書きしたいときだけ |

4. 保存後、**Redeploy**（環境変数は再デプロイで有効）

### 2-3. 未設定時の動き

- PDF変更の検知・スナップショット・承認待ちドラフト作成は動く  
- 要約は「AI整理なし」になり、人が原文を確認する前提になる  

---

## 3. Resend（メール通知）

### 3-1. API キーの取得

1. [Resend](https://resend.com) に登録・ログイン  
2. **API Keys** でキーを作成  
3. 送信ドメインを Resend に登録・検証する（本番では必須に近い）

### 3-2. 送信元メール

- 検証済みドメインのアドレスを使う（例: `監査のミカタ <noreply@your-domain.com>`）  
- 開発用の `onboarding@resend.dev` は本番向きではありません  

### 3-3. Vercel へ設定

| Name | Value |
|------|--------|
| `RESEND_API_KEY` | Resend の API キー |
| `RESEND_FROM_EMAIL` | 例: `監査のミカタ <noreply@your-domain.com>` |

未設定でも同期処理は止まりません。ログに `email_failed` / `RESEND_API_KEY が未設定` が出ます。

---

## 4. OPERATOR_EMAILS（フォールバック通知先）

マニュアル登録時に「通知メールアドレス」を空にした場合の送り先です。

| Name | Value 例 |
|------|-----------|
| `OPERATOR_EMAILS` | `you@example.com, partner@example.com` |

カンマ区切り。小文字化して照合します。

推奨: 実際に承認作業をする運営メンバーのメールを入れてください。

---

## 5. CRON_SECRET（毎日の自動同期）

Vercel Cron が `/api/cron/knowledge-sync` を叩くときの合言葉です。

### 5-1. 推奨の作り方

ターミナルで:

```bash
openssl rand -hex 32
```

出てきた長い文字列を使います。

### 5-2. Vercel へ設定

| Name | Value |
|------|--------|
| `CRON_SECRET` | （上で作った文字列） |

**未設定だと Cron は毎回 401 で失敗し、変更検知が動きません。**

`vercel.json` の Cron 定義（毎日 UTC 15:00 頃＝日本時間 0:00 前後）とセットで必要です。

---

## 6. Vercel への入れ方（共通手順）

1. Vercel → 対象プロジェクト → **Settings** → **Environment Variables**  
2. **Production** にチェックを付けて追加（Preview は任意）  
3. **Deployments** → 最新の … → **Redeploy**  
4. デプロイ完了を待つ  

値を変えただけでは古いデプロイには反映されないことがあります。必ず Redeploy してください。

---

## 7. 設定後の動作確認（素人向け）

### A. Cron が動くか

1. Vercel → **Logs** または Cron 実行ログを確認  
2. またはローカル／手元から（本番 URL と本番の `CRON_SECRET` を使用）:

```bash
curl -X POST "https://あなたの本番ドメイン/api/cron/knowledge-sync" \
  -H "Authorization: Bearer ここにCRON_SECRET"
```

期待: JSON で `ok: true` と件数サマリが返る（401 ではない）

### B. スナップショットが残るか

1. 管理画面で PDF直リンクのマニュアルを登録し「今すぐ同期」  
2. Supabase Storage の `knowledge-snapshots` に `.txt` が増える  

### C. 変更検知 → 承認待ち

1. （テスト用）監視先PDFの内容を変えられる環境か、ハッシュが変わる状況を用意  
2. 同期後、[本番]/admin/document-changes] に案件が出る  
3. `/admin/documents` の「変更承認」バッジ件数が増える  

### D. メールが届くか

1. `RESEND_*` と `OPERATOR_EMAILS`（または登録時の通知先）を設定  
2. 変更検知後、メールが届く  
3. 届かない場合: Vercel の関数ログで `knowledge-draft-notify` / `email_failed` を確認  

### E. 承認して反映

1. `/admin/document-changes` で内容を確認  
2. 確認記録を書いて「承認して反映する」  
3. ダッシュボードのお知らせに更新が載る  

---

## 8. トラブル時の見分け方

| 症状 | まず疑うこと |
|------|----------------|
| Cron が 401 | `CRON_SECRET` 未設定・不一致・未 Redeploy |
| 承認待ちは出るが要約が「AI整理なし」 | `GEMINI_API_KEY` 未設定、または Gemini 側エラー（1分後1回リトライ後も失敗） |
| メールが来ない | `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / 送信先 / ドメイン検証 |
| Storage エラー | `knowledge-snapshots` が無い、public、または MIME 不一致（`text/plain` を許可。`text/plain; charset=utf-8` だけ許可だと失敗する） |
| backfill が mime type … is not supported | マイグレーション `20260802070000_knowledge_snapshots_mime.sql` を適用するか、Edit bucket の Allowed MIME に `text/plain` を入れる |
| 一覧が取れない | マイグレーション未適用 |

---

## 9. セキュリティ上の注意

- `GEMINI_API_KEY` / `RESEND_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` は **サーバー側のみ**  
- `NEXT_PUBLIC_` を付けない  
- Git・チャット・スクリーンショットにキーを載せない  

---

## 関連画面

- 台帳登録: `/admin/documents`  
- 変更承認: `/admin/document-changes`  
- 施設向けお知らせ: ダッシュボード（承認後）  
