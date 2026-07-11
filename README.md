# 監査のミカタ

介護事業所向け「AI書類Wチェック」SaaS（Wチェック支援）。

## 技術スタック

- Next.js 14+ (App Router) / TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase（Auth・Postgres・Storage・RLS）
- Dify API（サーバーサイドのみ）
- Stripe（サブスクリプション）

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に各キーを記入

# macOS で "EMFILE: too many open files" が出る場合
ulimit -n 10240

npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

### Supabase マイグレーション

SQL Editor で次を **順番に** 実行します。

1. `supabase/migrations/20260711000000_auth_organizations.sql`（認証・事業所）
2. `supabase/migrations/20260711010000_documents_storage.sql`（書類・Storage）
3. `supabase/migrations/20260711020000_findings_check.sql`（AIチェック結果）
4. `supabase/migrations/20260711030000_finding_status_later.sql`（あとで確認ステータス）
5. `supabase/migrations/20260711040000_deadlines.sql`（期限アラート）
6. `supabase/migrations/20260711050000_reports.sql`（月次レポート）
7. `supabase/migrations/20260711060000_admin_review.sql`（運営レビュー）
8. `supabase/migrations/20260711070000_stripe_billing.sql`（Stripe課金）

その後：

- Authentication → Providers で Email を有効化
- 開発中は Confirm email をオフ推奨

## 動作確認手順（STEP 1：プロジェクト初期化とデザイン基盤）

1. `npm run dev` で開発サーバーを起動する
2. [http://localhost:3000/styleguide](http://localhost:3000/styleguide) を開き、コンポーネントとデザイントークンを確認する
3. 375px / 1280px でレイアウトが崩れないことを確認する
4. Tab キーでフォーカスリングが見えることを確認する
5. フッターの免責文言を確認する

## 動作確認手順（STEP 2：認証・事業所オンボーディング）

1. マイグレーション①を適用し、`.env.local` にキーを設定する
2. `/signup` でアカウント作成 → オンボーディング3画面を完了する
3. `npm run test:rls` で `PASS` を確認する

## 動作確認手順（STEP 3：書類アップロード）

1. マイグレーション②（`20260711010000_documents_storage.sql`）を SQL Editor で実行する
2. ログインした状態で [http://localhost:3000/check/upload](http://localhost:3000/check/upload) を開く
3. **ステップ1**: ファイルをドロップ／選択、またはスマホで「書類を撮影する」
   - 進捗バーが表示されること
   - 失敗時に「再試行」ができること
4. **ステップ2**: 書類種類をカードで選ぶ（自動判定の「候補」が先頭）
5. **ステップ3**: 「チェックを開始する」→ `/documents` 一覧へ遷移し、状態が「チェック中」になること
6. 一覧で「今日の分／過去の分」と空状態CTAを確認する
7. 受け入れ条件の目安
   - 375px幅で撮影→種類→開始がスムーズに進むこと
   - 大きめPDFでも進捗が見えること（画面遷移しても UploadProvider により継続）
   - Storage バケットは private。閲覧は署名付きURL（10分）のみ

## 動作確認手順（STEP 4：AIチェック連携と結果画面）

1. マイグレーション③（`20260711020000_findings_check.sql`）と④（`20260711030000_finding_status_later.sql`）を SQL Editor で実行する
2. `.env.local` でモックを有効にする（キー未設定でも可）
   ```
   DIFY_MOCK=1
   DIFY_MOCK_SCENARIO=success
   ```
3. `npm run test:check` で正常系・パース失敗・0件のモックテストが PASS すること
4. デモ画面（ログイン後・DB不要）で3画面を目視確認する
   - [正常系](http://localhost:3000/check/demo/success)
   - [パース失敗](http://localhost:3000/check/demo/parse_error)
   - [0件](http://localhost:3000/check/demo/empty)
5. 実ファイル動線: `/check/upload` → チェック開始 → `/check/[documentId]`
   - 「チェック中」のあと結果サマリーと指摘カードが表示されること
   - 「対応した / あとで / これは違うと思う」が片手で押せること（44px以上）
   - 操作後の並びが「これから確認 → あとで確認 → 違う指摘 → 対応した」になること
   - 「あとで」を押すと結果画面の「あとで確認」と `/later` の両方に出ること
   - 全件対応（あとでを残さない）で完了演出が出ること
6. 設定 →「人間レビューをスキップ」をオフにすると、承認前は指摘が非表示になること
7. 「対応した」操作が `finding_action_logs` に残ること（月次レポート集計用）

### 本番 Dify への切替

1. Dify Workflow の API キーを `.env.local` / Vercel の `DIFY_API_KEY` に設定（チャットや Git に書かない）
2. `DIFY_BASE_URL=https://api.dify.ai`（末尾 `/v1` ありでも可。コード側で正規化）
3. **`DIFY_MOCK=0`** にして開発サーバー再起動（本番は Vercel 再デプロイ）。`DIFY_MOCK=1` のままだと本物の Dify は呼ばれません
4. Workflow 入力変数は次を想定:
   - `document_text` / `prefecture` / `municipality` / `doc_type` / `national`（`"1"`=国基準・`"0"`=自治体基準）
5. Workflow 出力は JSON（例: `{ "findings": [{ "severity", "title", "description", "basis", "suggestion" }] }`）。パースできないと「AIが確認できませんでした…」になります
6. 失敗時は Vercel Runtime Logs の `[dify] check`（HTTP status・outputKeys・parseOk）を確認（個人情報は含めません）

## 動作確認手順（STEP 5：ダッシュボードと期限アラート）

1. マイグレーション⑤（`20260711040000_deadlines.sql`）を SQL Editor で実行する（**ファイルの中身**を貼る）
2. `/` ダッシュボードを開く
   - 最上部が「今日やること」であること
   - 右上（スマホは上部）に「今日の分をチェックする」があること
   - 「今週のチェック状況」が大きな数字3つであること
3. `/alerts` で期限を手動追加し、タブ（超過／7日以内／30日以内／完了）を切り替える
4. 「対応した」で完了タブへ移ること。超過はアイコン＋「超過」ラベルであること
5. （任意）メール通知
   - `.env.local` に `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `CRON_SECRET` を設定
   - `curl -X POST http://localhost:3000/api/cron/deadline-reminders -H "Authorization: Bearer $CRON_SECRET"`
   - 本番は Vercel Cron（`vercel.json`：毎日 23:00 UTC ＝ 翌朝 8:00 JST）

## 動作確認手順（STEP 6：月次レポート）

1. マイグレーション⑥（`20260711050000_reports.sql`）を SQL Editor で実行する
2. プレミアム表示の確認（開発用）
   ```sql
   UPDATE public.organizations SET plan = 'premium' WHERE id = '<事業所ID>';
   ```
3. 管理者で [http://localhost:3000/admin/reports](http://localhost:3000/admin/reports) を開く
   - **原因分析はAI自動生成ではありません。** 管理者が Markdown を手入力して保存します
   - 対象月・件数・Markdown本文を入力して「レポートを保存する」
   - 「指摘データから件数を反映する」で high／対応済み件数を自動入力できること
4. [http://localhost:3000/reports](http://localhost:3000/reports) で
   - サマリー（リスク件数／対応済み）が大きく表示されること
   - 原因分析が見出し・引用・表つきで読めること
   - 指摘の内訳が横棒（多い順）であること
   - 「PDFをダウンロード」→ 印刷ダイアログで「PDFに保存」、A4縦・フッターに免責文言
5. 未作成の月を選ぶと「まだレポートがありません」（設定→レポート管理で作成する案内）が出ること
6. プラン制限
   ```sql
   UPDATE public.organizations SET plan = 'light' WHERE id = '<事業所ID>';
   ```
   - `/reports` でぼかしプレビュー＋アップグレード案内が出ること
7. スタッフ（role=staff）で `/admin/reports` にアクセスすると `/reports` へリダイレクトされること

## 動作確認手順（STEP 7：運営レビューコンソール）

1. マイグレーション⑦（`20260711060000_admin_review.sql`）を SQL Editor で実行する
2. 自分のアカウントを運営にする（どちらか一方）
   ```sql
   UPDATE public.profiles SET is_operator = true WHERE id = '<自分のuserID>';
   ```
   または `.env.local` に `OPERATOR_EMAILS=you@example.com`
3. 事業所の人間レビューを有効化（設定画面、または SQL）
   ```sql
   UPDATE public.organizations SET skip_finding_review = false WHERE id = '<事業所ID>';
   ```
4. 書類をアップロードしてチェック → 指摘はユーザー画面に出ないこと（「確認中」表示）
5. [http://localhost:3000/admin](http://localhost:3000/admin) を開く
   - 未承認キューに事業所名・書類種別・自治体が出ること
   - **キーボードのみ**: `J`/`K` で移動、`A` で承認（マウスなしで1件完結）
   - 文言修正 → `⌘↵`（Windows は `Ctrl↵`）で修正承認、`R` で却下
   - 上部に平均レビュー時間・未承認件数・本日処理件数が表示されること
6. 「これは違うと思う」を押した指摘が下部フィードバックに出ること。対応メモを保存できること
7. 自動テスト
   ```bash
   npm run test:review
   ```
   - `PASS: pending の指摘はユーザー SELECT で 0 件` が出ること

## 動作確認手順（STEP 8：Stripe課金とプラン制御）

1. マイグレーション⑧（`20260711070000_stripe_billing.sql`）を SQL Editor で実行する
2. [Stripe Dashboard](https://dashboard.stripe.com/test/products)（テストモード）で商品・価格を作成
   - ライト 19,800円／月、スタンダード 29,800円／月、プレミアム 39,800円／月（税別想定）
   - 初期導入費 50,000円（一回限り）
3. `.env.local` にキーを設定
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_LIGHT=price_...
   STRIPE_PRICE_STANDARD=price_...
   STRIPE_PRICE_PREMIUM=price_...
   STRIPE_PRICE_SETUP=price_...
   ```
4. ローカル Webhook
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   表示された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に入れる（dev 再起動）
5. [http://localhost:3000/pricing](http://localhost:3000/pricing) でスタンダード（主力プランバッジ）を契約（テストカード `4242…`）
6. **Customer Portal（必須）**  
   Stripe Dashboard（テストモード）→ [Settings → Billing → Customer portal](https://dashboard.stripe.com/test/settings/billing/portal) を開き、カード変更・解約などを有効にして **Save** する。未保存だと「カード変更・解約」が開けません。
7. 設定でプラン表示・「カード変更・解約する」→ Customer Portal でプラン変更／解約
8. 受け入れの目安
   - [1] 契約→変更→解約が一巡できること
   - [2] 解約後も書類・指摘は残り、設定に「閲覧のみ」案内と再契約導線があること
   - [3] ライトで月2回目のチェック開始時に「今月の上限に達しました。スタンダードなら毎日チェックできます」が出ること
9. （開発用）Stripeなしでプランだけ試す場合
   ```sql
   UPDATE public.organizations SET plan = 'light' WHERE id = '<事業所ID>';
   ```

## 主なルート

| パス | 内容 |
|------|------|
| `/login` | ログイン |
| `/signup` | アカウント作成 |
| `/onboarding` | 初回オンボーディング |
| `/invite/[token]` | 招待受諾 |
| `/` | ダッシュボード（今日やること・週次・最近の指摘） |
| `/documents` | 書類一覧（今日／過去） |
| `/check/upload` | 書類アップロード（3ステップ） |
| `/check/[documentId]` | チェック結果 |
| `/check/demo/[scenario]` | 結果画面デモ（success / parse_error / empty） |
| `/later` | あとで確認リスト |
| `/alerts` | 期限アラート |
| `/reports` | 月次レポート（プレミアム：原因分析・PDF） |
| `/pricing` | 料金プラン（公開） |
| `/admin` | 運営レビューコンソール（運営のみ） |
| `/admin/reports` | 月次レポート管理（管理者のみ） |
| `/settings` | 設定・招待・ログアウト |
| `/styleguide` | デザインシステム確認用 |

## スクリプト

```bash
npm run dev         # 開発サーバー
npm run build       # 本番ビルド
npm run start       # 本番起動
npm run lint        # ESLint
npm run test:rls     # RLS事業所分離テスト
npm run test:check   # AIチェック モック／パーステスト
npm run test:review  # 人間レビュー公開制御テスト
```
