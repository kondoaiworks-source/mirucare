# 監査のミカタ

介護事業所向け「AI書類Wチェック」SaaS（Wチェック支援）。

**公式ポジション：** 合否・返還は保証しないが、実務上の致命傷を未然に浮かび上がらせる予防装置。  
完成図（5つのコア機能）：[docs/プロダクト完成図.md](docs/プロダクト完成図.md)  
Phase1改訂の確定事項：[docs/PHASE1_REDESIGN.md](docs/PHASE1_REDESIGN.md)

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
9. `supabase/migrations/20260713080000_attendance_service_records.sql`（勤怠・日報・シフト）
10. `supabase/migrations/20260713090000_helpers_employee_code_unique.sql`（職員コードユニーク）

その後：

- Authentication → Providers で Email を有効化
- 開発中は Confirm email をオフ推奨

## 動作確認手順（STEP 1：プロジェクト初期化とデザイン基盤）

1. `npm run dev` で開発サーバーを起動する
2. [http://localhost:3000/styleguide](http://localhost:3000/styleguide) を開き、コンポーネントとデザイントークンを確認する
3. スタイルガイドのトーストを出し、バツを押すまで消えないこと
4. 375px / 1280px でレイアウトが崩れないことを確認する
5. Tab キーでフォーカスリングが見えることを確認する
6. フッターの免責文言を確認する

## 動作確認手順（STEP 2：認証・事業所オンボーディング）

1. マイグレーション①を適用し、`.env.local` にキーを設定する
2. ルールブック公開カタログ用に `20260730050000_rulebook_offerings.sql` も適用する（訪問介護×Phase1市が公開済みで投入される）
3. `/signup` でアカウント作成 → オンボーディング3画面を完了する
   - サービス種別は**公開中のものだけ**出ること（通所介護は非公開のため出ない）
   - 自治体は選んだサービスで**公開中のものだけ**出ること
4. `npm run test:rls` で `PASS` を確認する

## 動作確認手順（ルールブック公開設定）

1. `20260730050000_rulebook_offerings.sql` を適用する
2. 運営アカウントで `/admin/rules/municipalities` を開く（旧 `/admin/rules/services/homecare/municipalities` からもリダイレクト）
3. 「市区町村一覧（運用／停止）」で Phase1市が表示され、運用中であること
4. 介護サービス選定で通所介護は「停止（準備中）」であること（施設の登録画面に通所介護が出ないこと）
5. 国・県・市のいずれかに公開情報PDFが無い市は「運用する」が押せないこと（共通層前提）
6. 運用中の市を「停止する」→ 既存施設の設定画面ではその市が「現在の設定・公開終了済み」として残ること
7. 新規オンボーディングでは停止中の市が選べないこと

## 動作確認手順（ルール設定：サービス起点 IA）

構想の正：[docs/ルールブック構想.md](docs/ルールブック構想.md)

1. 運営アカウントで [http://localhost:3000/admin/rules](http://localhost:3000/admin/rules) を開く
2. `/admin/rules/setup`（利用設定）へリダイレクトすること
3. 左メニューが「利用設定／監視状況」の2本であること
4. 利用設定が「サービス設定」と「マスタ管理」（サービスマスタ／自治体マスタ）であること。領域マスタが無いこと
5. 訪問介護ハブが「ルールブック作成／ルールブック閲覧／根拠情報」の3枠であること
6. ルールブック閲覧で国・県または自治体を選び、ルール一覧が出ること。根拠情報のカバー率は根拠カテゴリのうち資料を置いた割合で、未登録カテゴリへの追加案内と資料名・URLが同じ枠に出ること
7. `/admin/rules/audit-items` が訪問介護ハブへリダイレクトすること
8. 旧URL `/admin/rules/services/homecare/national-prefecture` と `.../municipalities` が、閲覧画面または自治体マスタへリダイレクトすること
9. `/admin/rules/monitoring`（監視状況）がサイドナビのもう1本であること。差分ありの詳細から「確認してルールブックを作り直す」、エラーから「根拠情報でリンクを直す」へ進めること
10. 旧URL `/admin/rules/pending`・`/admin/rules/manual`・`/admin/rules/history` が利用設定へリダイレクトすること。`/admin/rules/domains` も利用設定へリダイレクトすること

## 動作確認手順（カバー率とルールブック下書き）

SQL Editor で `supabase/migrations/20260814090000_rule_domains.sql` を適用する（内部紐づけ用。画面には領域を出さない）。

1. 利用設定に「領域マスタ」が無いこと。[http://localhost:3000/admin/rules/domains](http://localhost:3000/admin/rules/domains) が利用設定へ戻ること
2. マスタ管理に「サービスマスタ」「自治体マスタ」があること
3. 訪問介護 → ルールブック作成 を開く
   - 「1. 国・県」に国・県の資料確認と「ルール案を生成」があること
   - 「2. 市」で自治体を選ぶと市の資料と「ルール案を生成」があること
   - 領域選択は画面に出ないこと
   - 作成後の案内トーストはバツを押すまで残ること
4. 下書き画面（`.../compose/[jobId]`）のルール一覧カードが閲覧と同じ構成であること（ルール名・国・県／市固有・本文）。登録済みは読み取り専用で保存ボタンが無いこと。承認待ちは本文を直せるが、カードに保存ボタンは無いこと。直した文は「確定する」で一緒に残ること。下書きから外す／下書きに戻す・確定する／全て破棄するができること。カバー率・参照資料数・「公式資料からの抽出」は下書き専用として残ること。遷移先URLは変わらないこと
5. 確定するまで施設の書類チェックに新しいルールが載らないこと。国・県の確定後は作成へ戻り、市の確定後は閲覧へ進むこと
6. 確定後、ルールブック閲覧の「国・県」に共通ルールだけ、「横浜市」に横浜市のルールだけが出ること。領域フィルタが無いこと
7. ルールブック閲覧で登録済みルールの保存ボタンが無いこと。停止・削除と、画面下の「ルールを追加する」ができること。根拠情報のカバー率が根拠カテゴリ（資料名・URL・修正／ルールブックへ追加）と一致すること。国／県／市で資料を追加するときに根拠カテゴリを選べること
8. SQL Editor で `supabase/migrations/20260814120000_compose_origin_city_pdf.sql` と `20260814140000_compose_origin_official.sql` と `20260815040000_compose_extraction_notes.sql` を適用する。「ルール案を生成」で国・県・市の公式資料から観点が出ること。本文がある資料は1件ずつ読むこと。一部の資料で抽出に失敗しても、出せた観点は了承画面に残ること。了承画面に層ごとの抽出結果（資料件数／本文件数／出せた件数または出せなかった理由）が出ること。本文0件の層は「根拠情報でリンクを確認する」へ進めること。資料が無い層だけ標準の見比べ観点で穴埋めされること。古い「観点です」下書きが残っているときは破棄して作り直すこと。ボタンは「資料を読んでいます…」になり、数分かかることがあること
9. 公式資料から新しく追加する候補が0件だった場合、了承画面に「既存ルールに含まれている可能性がある候補」「今回は使わない候補」「新しく追加する候補はありませんでした」など、0件理由が自然な日本語で出ること。市の資料でAIが空にした場合でも、自治体だけの補足候補が下書きに載ること
10. 書類チェックを実行し、適用ルール版に基本突合以外の承認済み頻出観点ルール（例：契約・同意、感染症BCP、事故報告など）が、対象書類種別に応じて含まれること
11. ルールブック閲覧 → 横浜市でカバー率と確定済みルール一覧が出ること。初回登録・監査観点の確認状況・頻出観点の基本確認・次にやることは出ないこと

## 動作確認手順（判定ルールを国・県／市で分ける）

SQL Editor で `supabase/migrations/20260812080000_ai_check_rules_scope.sql` を適用する。

1. 訪問介護 → ルールブックを見る → 国・県
   - 共通ルールだけが出ること
2. ルールブックを見る → 横浜市
   - 横浜市のルールだけが出ること（国・県の共通は「国・県」側）
   - 川崎市だけのルールが出ないこと
3. 横浜の施設で書類チェックすると、国・県の共通ルールと横浜市のルールが足されること
4. `/admin/rules/pending` を開くと利用設定へリダイレクトすること

## 動作確認手順（STEP 3：日次チェックのアップロード）

> 2026-07 変更: 「アップロード後にファイルごとの種類を選ぶ」導線を廃止し、**先に何をチェックするかを選んでからアップロードする**導線に変更しました。ナビの「書類チェック」は「日次」に、「突合」は「月次」に名称変更しています。

1. マイグレーション②（`20260711010000_documents_storage.sql`）を SQL Editor で実行する
2. ログインした状態で [http://localhost:3000/check/upload](http://localhost:3000/check/upload) を開く
3. **ステップ1（何をチェックしますか？）**: 目的カードを1つ選ぶ
   - 「提供記録をチェックする／ケアプランをチェックする／勤務表をチェックする／請求をチェックする／その他の書類をチェックする」から選択（各カードにアップロードする書類の案内あり）
   - 選ぶと自動でステップ2へ進むこと
4. **ステップ2（アップして開始）**: 同じ種類の書類だけをまとめてドロップ／選択、またはスマホで撮影
   - 見出しに選んだ種類（例『提供記録』）が出ること。「種類を変える」でステップ1に戻れること
   - 進捗バーが表示され、失敗時に「再試行」ができること
   - ファイルごとの種類選択が**出ない**こと（選んだ種類が全ファイルの `doc_type` になる）
5. 「日次チェックを開始する」を押す
   - 選んだ種類と、ファイル名から推定した種類が食い違う可能性がある場合、確認ダイアログが出ること
     - 断定せず「〜の可能性があります」と表示し、該当ファイル名を出すこと
     - 「このまま『◯◯』でチェックする」を選ぶと、アップ前に選んだ種類で開始すること
     - 「ファイルを入れ直す」を選ぶとアップ一覧へ戻り、該当ファイルを×で削除できること
6. `/documents`（日次）一覧へ遷移し、状態が「チェック中」になること（または結果画面へ）
7. 一覧で「今日の分／過去の分」と空状態CTAを確認する
8. **種類未設定の取り消し**: ステップ2だけ済ませて離脱すると一覧に「種類未設定」が残る。カードの「このアップロードを取り消す」で一覧・ナビバッジから消えること（完了ボタンでは消えない）
   - 先に SQL で `20260714020000_cancel_uploaded_document_rpc.sql` を実行する（未実行だと RPC 無しで service role にフォールバック）
   - スマホでも取消ボタンが押せること（カード全体のリンクではなく独立ボタン）。「種類を選んで続ける」から同じ書類の種類確認へ再開できること
   - ウィザードで一覧の×を押したあと再アップしても、旧の「種類未設定」が増えないこと（ローカル削除時にDBも取消）
9. 受け入れ条件の目安
   - 375px幅で「種類選択→アップ→開始」がスムーズに進むこと
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
   - 指摘0件のときは「完了」ボタン → 一覧で完了バッジになり、ナビの未完了件数が減ること
6. 書類一覧（`/documents`）の今日の分が「確認待ち → 後で確認 → 完了」の順に並ぶこと（約4秒ごとに更新）
7. 「日次」ナビに未完了件数バッジが出ること
8. 設定 →「人間レビューをスキップ」をオフにすると、承認前は指摘が非表示になること
9. 「対応した」操作が `finding_action_logs` に残ること（月次レポート集計用）

## 動作確認手順（指摘の分類とルール本文の渡し方）

書類同士の不整合と、適用ルール根拠の指摘を混ぜない。1ルール 400 文字の先頭切り捨てはしない。

1. SQL Editor で `supabase/migrations/20260818090000_findings_check_type.sql` を実行する
2. Dify Workflow のプロンプト／出力 JSON を [docs/dify-check-workflow.md](docs/dify-check-workflow.md) に合わせて再公開する（アプリの入力変数は増やさない）
3. `npx vitest run src/lib/check/check-type.test.ts src/lib/rule-engine/guidance-for-dify.test.ts src/lib/rule-engine/resolve-check-rules.test.ts` が PASS すること
4. `npm run test:check` が PASS すること（モックに `consistency` と `rule` が混在）
5. `/check/demo/success` を開き、次を確認する
   - 「AIチェック結果」に整合性・ルールの件数が分かれて出ること
   - フィルター「すべて / 整合性 / ルール」で表示が切り替わること
   - 整合性カードは「比較内容を表示」、ルールカードは「適用ルールを表示」があること
6. 実チェック後の Vercel / 開発ログに `[dify] rules payload check` が出ること（`guidanceLength` / `guidanceTruncated` のみ。`document_text` や guidance 全文は出ない）
7. 結果の「このチェックで使った基準」に、渡した本文の字数と（抜粋時は）その旨が出ること
8. マイグレーション前の過去結果は画面エラーにならず「分類未設定」になること

## 動作確認手順（STEP 4：Dify 接続）

### Dify が動いているか確かめる

1. 本番で**新しい**書類をアップロードしてチェックする（古い結果は残るので新規が確実）
2. レスポンス JSON の `mode` を確認（DevTools → Network → `/api/check`）
   - `mode: "live"` → 本物の Dify を呼んだ
   - `mode: "mock"` → モック（本番では出ない想定）
   - `mode: "skipped_no_file"` → Storage 取得失敗で **Dify 未呼び出し**
   - `mode: "unreadable"` → 本文が取れず **Dify 未呼び出し**（画面は「本文を読み取れませんでした」）
   - `mode: "dify_error"` → キー未設定 / `DIFY_MOCK=1` などで拒否
3. 「AIが確認できませんでした…」ではなく、具体的な指摘タイトルが出れば連携成功
4. Vercel → Deployments → Runtime Logs で検索
   - `[dify] invoke_live` → API 呼び出し開始
   - `[dify] check` で `parseOk: true` → 成功
   - `[dify] using_mock` / `[check] storage_download_failed` → **Dify は呼ばれていない**
5. Dify の「ログ」に `kansatsu-check` の実行が増えていれば API 到達成功（「監視」のメッセージ数は Workflow では増えにくいことがあります）
6. **スキャンPDF（画像のみのPDF）**: 本文が取れない場合は Dify にファイルを無理に送らず、`[check] skip_dify_unreadable` のあと「本文を読み取れませんでした」になります。文字入りPDFにして出し直してください
7. Vercel Logs の `[dify] check` は `errorHint` だけでなく `errorCode` / `errorMessage` も確認する。`invalid_param` はファイル以外（例: `Model is not configured`）でも返ります。LLM ノードでモデル未設定のときは `errorHint: "model_not_configured"`
8. Dify ログで FAILURE かつ `messages: at least one message is required` のときは、Vision が LEGACY `files` のままか、`document_image` 未接続です。開始の `document_image` は任意のファイルリストにし Vision に接続して再公開。有効な画像を送ったあと同エラーなら、アプリは `document_image` なしで1回再試行します（ログ: `[dify] retry_without_files`）
9. Dify が `meta.unreadable: true` を返した場合、画面に「本文を読み取れませんでした」と出ること
10. **サンプルPDF** `public/samples/check-text-readable.pdf`（再生成: `npm run generate:sample-check-pdf`）を上げたとき、`kind: "text"` かつ `[check] extracted` の `textLength` が数十以上であること（失敗定型の **44ではない**）。`[extract] pdf_runtime` の `cMapUrlKind: "http"` が出ること。`[extract] pdf_parse_text_failed` は出ないこと。プレビューで文字を選択できること
11. 本文が空のときは Dify を呼ばず、`[check] skip_dify_unreadable` のあと画面が「本文を読み取れませんでした」になること（指摘0件にしない）

### 本番 Dify への切替

1. Dify Workflow の API キーを `.env.local` / Vercel の `DIFY_API_KEY` に設定（チャットや Git に書かない）
2. `DIFY_BASE_URL=https://api.dify.ai`（末尾 `/v1` ありでも可。コード側で正規化）
3. **`DIFY_MOCK=0`** にして開発サーバー再起動（本番は Vercel 再デプロイ）。`DIFY_MOCK=1` のままだと本物の Dify は呼ばれません
4. 本番ではモックを黙って使わずエラーにします（監視が 0 のまま成功する事故を防ぐ）
5. Workflow 入力変数は次を想定:
   - **必須テキスト**: `document_text` / `prefecture` / `municipality` / `doc_type` / `national`（`"1"`=国基準・`"0"`=自治体基準）。アプリは互換のため `document_type`（`doc_type` と同値）も送ります
   - `approved_rules_json` / `regulatory_basis_json` / `check_as_of`（承認済みルール・根拠資料タイトル・基準日。未定義でも Workflow は動く想定）
   - **`document_image`（ファイルリスト・必須オフ）**: 画像を File Upload したあと、**有効なファイルがあるときだけ** `inputs.document_image` に `{ type, transfer_method: "local_file", upload_file_id }` の配列を載せる。CSV・文字入りPDFではキーごと送らない（`[]` / `null` / `""` も送らない）
   - 開始ノードに `document_image` がある場合は必須オフ。テキストだけで実行できることを Dify 上で確認して再公開する
   - LLM ノードでモデルが未設定だと HTTP 400 `Model is not configured` になります（ファイル有無とは別）
   - 変数名が違う場合は Vercel / `.env.local` の `DIFY_FILE_INPUT_KEY` を合わせる（既定: `document_image`）
6. Workflow 出力は JSON（例: `{ "findings": [{ "check_type", "severity", "title", "description", "basis", "suggestion" }] }`）。`check_type` は `consistency`（書類同士）または `rule`（適用ルール）。詳細は [docs/dify-check-workflow.md](docs/dify-check-workflow.md)。出力変数名は `check_result` / `result` / `text` / `answer` / `output` / `findings` などに対応。パースできないと「AIが確認できませんでした…」になります
7. 読めない場合は `{ "findings": [], "meta": { "unreadable": true, "model_notes": "…" } }` を返すと、アプリが「本文を読み取れませんでした」と表示します
8. 失敗時は Vercel Runtime Logs の `[dify] request payload check` / `[dify] check` / `[dify] file_uploaded` / `[dify] retry_without_files` を確認（個人情報は含めません）

## 動作確認手順（Dify payload: CSV / 文字PDF / 画像）

CSV・文字入りPDFは `document_text` で点検し、`document_image` は有効な画像があるときだけ送ります。

1. `npx vitest run src/lib/dify/workflow-payload.test.ts src/lib/dify/errors.test.ts src/lib/dify/client.test.ts src/lib/check/extract.test.ts` が PASS すること
2. 開発サーバーのログ `[dify] request payload check` で次を確認する
   - CSV / 文字入りPDF: `hasDocumentImage: false`、`documentImageCount: 0`、`inputKeys` に `document_text` / `doc_type` / `document_type` / `national` があり `document_image` が無い
   - 画像: File Upload 成功時のみ `hasDocumentImage: true`、空配列は付かない
3. `/check/upload` から `public/samples/attendance-service-records.csv`（提供記録）を上げ、本文が取れ `document_image` が送られないこと
4. `/check/upload` から `public/samples/check-text-readable.pdf` を上げ、本文抽出のあと `document_image` が送られないこと
5. 画像を上げたときは `[dify] file_uploaded` のあと `inputs.document_image` に `upload_file_id` があること。空や不正なオブジェクトは送らない
6. `[dify] check` の `errorHint` がかつての `invalid_file_param` でも、`errorMessage` が `Model is not configured` ならファイルではなく Dify の LLM ノードでモデルを設定して再公開する

## 動作確認手順（書類同士：ケアプラン更新日と計画書の日付）

ルールブックに無い場合でも、今回一緒に入れた分の本文から日付を比べます（1枚でも、別ファイルでも。合否にはしません）。

1. SQL Editor で `supabase/migrations/20260816090000_document_check_set.sql` を実行する
2. `npx vitest run src/lib/check/plan-date-alignment.test.ts src/lib/check/alignment-catalog.test.ts` が PASS すること
3. 文字入りPDF（スキャン画像のみは対象外）に、次が読める形で入っていること。確認用は `public/samples/check-text-readable.pdf`
   - ケアプラン（または居宅サービス計画）の更新日／変更日
   - 訪問介護計画の作成日／更新日が、それより前
   - 同じPDFでも、別PDFをまとめて上げてもよい
4. `/check/upload` から「今日の分」としてアップロードしてチェックする（先頭の結果画面だけがセットを実行する）
5. 結果に「訪問介護計画の日付がケアプラン更新に追いついていない可能性があります」が **書類同士のご確認** に出ること（「不適合」とは出ない）
6. 日付が片方しか無い、または計画の日付が同じ／新しい場合は、この指摘が出ないこと
7. 「このチェックで使った基準」に「計画の更新日の確認」が出ること（標準観点。ルールブック未確定でも載る）
8. 複数ファイルのときは「今回一緒に入れた N件」と出ること。Vercel / 開発ログに `[check] plan_date_alignment` と `setSize` / `mismatched` が出ること（日付・氏名は出さない）

## 動作確認手順（抽出確認用サンプルPDF）

スキャンではなく、日本語フォントを埋め込んだ文字入りPDFです。CMap が無くても unpdf が本文を抜けます。

1. `npx vitest run src/lib/check/extract.test.ts` が PASS すること（埋め込み日本語サンプルから本文と日付整合を拾う）
2. `public/samples/check-text-readable.pdf` をプレビューで開き、文字を選択・コピーできること
3. `/check/upload` で「ケアプランをチェックする」を選び、このPDFをアップロードしてチェックする
4. ログ `[check] extracted` が `kind: "text"` かつ `textLength` が数十以上であること（「本文を読み取れませんでした」にならないこと）
5. 結果の「書類同士のご確認」に、訪問介護計画の日付がケアプラン更新に追いついていない指摘が出ること
6. 再生成する場合は `npm run generate:sample-check-pdf`（macOS は Arial Unicode、無い環境は Noto Sans JP を取得）

## 動作確認手順（STEP 5：ダッシュボードと期限アラート）

1. マイグレーション⑤（`20260711040000_deadlines.sql`）を SQL Editor で実行する（**ファイルの中身**を貼る）
2. `/` ダッシュボードを開く
   - 最上部が「今日やること」であること
   - **未完了の書類チェック**（種類未設定など）が期限より先に出ること（書類一覧とは連動）
   - **まもなくの期限**は同意日などの期限アラートであり、書類件数とは別であること（ヒント文言あり）
   - 右上（スマホは上部）に「今日の分をチェックする」があること
   - 「今週のチェック状況」が大きな数字3つであること
3. `/alerts` で期限を手動追加し、タブ（超過／7日以内／30日以内／完了）を切り替える
4. 「対応した」で完了タブへ移り、ダッシュボードの「まもなくの期限」からも消えること。超過はアイコン＋「超過」ラベルであること
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

## 動作確認手順（STEP 9：月末の確認＝投入カバレッジ・勤怠矛盾・請求CSV照合）

> 2026-07 変更: 「雑多なCSVをまとめて入れて後で分類する」導線を廃止し、**投入場所を用途ごとに分ける**導線に変更しました（ナビ名称は「突合」→「月次」→「月末の確認」）。
>
> 2026-07 追加（フェーズA＋B）: 月末ハブを「4大書類の投入状況＋矛盾候補一覧＋用途別入口」に再構成。憲章バナー（予防装置・保証しない）と検証カバレッジ（投入済み／未投入）を施設向け画面に明示。

1. マイグレーション⑨⑩（`20260713080000_…` / `20260713090000_…`）を SQL Editor で実行する
2. [http://localhost:3000/](http://localhost:3000/) ダッシュボード
   - 「Wチェック支援（予防装置）」バナーと「月末の確認をはじめる」ボタンがあること
3. [http://localhost:3000/reconcile](http://localhost:3000/reconcile)（月末の確認）を開く
   - 憲章バナー・「4大書類の投入状況」・「矛盾候補（勤怠×日報）」・用途別4カードがあること
   - 未投入があるとき警告が出ること。投入後は「投入済み」ラベルに変わること
4. **日報CSVを取り込む**（`/attendance/import?kind=service_records`）
   - 見出しが「日報CSVを取り込む」、データの種類が「サービス提供記録（日報）」に固定されていること
   - `/samples/attendance-service-records.csv` を取り込めること（時間重複の例を含む）
5. **勤怠・タイムカードCSVを取り込む**（`/attendance/import?kind=attendance`）
   - 見出しが「勤怠・タイムカードCSVを取り込む」、データの種類が「タイムカード（勤怠）」に固定されていること
   - `/samples/attendance-timecard.csv` を取り込めること
   - **別種CSVの確認**: 日報の取込画面で勤怠CSV（またはその逆）を入れると、「別の種類のCSVの可能性があります」と該当ファイル名が出て、「CSVを入れ直す」が主ボタンになること。「内容を確認してこのまま取り込む」は目立たない例外導線であること
6. `/reconcile` に戻り、矛盾候補が一覧に出ること（または「見つからない」＋未検証注意）
7. [http://localhost:3000/attendance](http://localhost:3000/attendance)（勤怠の矛盾を確認する）で「矛盾を検知する」→ `OVERLAP` / `TIME_DISCREPANCY` が出ること。文言が「〜の可能性／ご確認ください」であること
8. **請求CSVを照合する**（`/billing-reconcile`）で対象月を選び、ローカルの `.csv` をドロップ
   - **請求CSVはサーバーへ送信・保存されない**（DevTools Network で確認）
   - 完全一致は緑、ズレ／日報なしは赤で警告（「〜の可能性」ラベル）
   - 勤怠・シフトなど別種CSVを入れた場合は「請求CSVをご確認ください」と入れ直し導線が出ること
9. 書類チェック結果（`/check/[id]`）で、指摘あり／ゼロ件の双方に「未検証・最終判断は施設」の注意があること
10. 受け入れの目安
   - [1] 月末ハブで投入状況と矛盾候補が分かること
   - [2] 用途別の入口からCSV取込・矛盾検知・請求照合ができること
   - [3] RLS により他事業所の日報が見えないこと
   - [4] 請求CSV用の Storage / テーブルが存在しないこと（ブラウザ内処理のみ）
   - [5] 日報・勤怠CSVは必要項目だけDBに保存し、元CSVや被保険者番号は保存しないこと
   - [6] `npm run test` で突合・矛盾・取込パーサの単体テストが通ること
   - [7] UIに「違反です／返還を防ぐ／保証する」などの断定・保証表現が出ないこと

## 動作確認手順（フェーズC＋D：辞書接続・世代可視化）

> 完成図の③④⑤とチェック実行をつなぐ。承認済みAIルールを Dify 入力へ渡し、結果に「いつの版で見たか」を残す。

1. Supabase SQL Editor で `supabase/migrations/20260722100000_document_check_rule_snapshot.sql` を実行する
2. （任意）ルール設定で承認済み判定ルールを1件以上用意する（`/admin/rules/ai-rules` → 承認待ち → 承認）
3. 書類をアップロードしてチェックを実行する
   - サーバーログに `[check] applied_rules`（件数）が出ること
   - モック時は `[dify] mock_rules_payload` で rules/basis の有無が出ること
4. `/check/[documentId]` で **「このチェックで使った基準」** が表示されること
   - 基準日・適用ルール版（開閉）・根拠資料タイトル（あれば）
   - 各指摘の「根拠」テキストも従来どおり表示
5. `/documents` の完了／レビュー済みカードに **基準日** が出ること
6. `/admin/document-changes`（またはルール配下の変更承認）で
   - 「辞書反映は2段階」の説明があること
   - 承認後トースト／「AI判定ルールの改訂案を作る」導線があること
   - `?fromDraft=` 付きで AI 判定ルール画面を開くと案内バナーが出ること
7. Dify Workflow（本番）に任意変数を追加（未定義でもアプリは文字列を送る）:
   - `approved_rules_json` / `regulatory_basis_json` / `check_as_of`
8. `npm run test` が通ること（`resolve-check-rules` のシリアライズ含む）

```bash
npm install papaparse react-dropzone
npm install -D @types/papaparse
```

## 動作確認手順（画面遷移パフォーマンス：Streaming / Suspense）

1. `npm run dev` で起動し、ログインする
2. サイドバーまたは下部タブで「ダッシュボード ↔ 書類チェック ↔ あとで確認」などを連続クリックする
3. クリック直後にスケルトン（グレーのパルス）が表示され、シェル（サイドバー／ヘッダー）は残ったまま中身だけ切り替わること
4. `/documents` では見出しと「今日の分をチェックする」が先に表示され、一覧部分だけスケルトン→実データになること
5. チェック結果から「あとで確認」トーストの「あとで確認を見る」を押すと、フルリロードせずソフト遷移すること（`window.location` ではない）
6. ネットワークを Slow 3G にしても、遷移フィードバック（loading / Skeleton）が即座に出ること

## 動作確認手順（モバイルナビ整理）

1. スマホ幅（375px）でログインする
2. 下部タブが「ホーム／日次／あとで／月次／期限」の5項目で、押しやすいこと
3. ヘッダー右上のメニュー（ハンバーガー）から「月次レポート」「設定」に遷移できること
4. PC幅ではサイドバーに全項目があり、ハンバーガーが出ないこと
5. `/settings` で各カード見出しにアイコンがあり、「契約・事業所／管理者向け／運営向け」の区切りが分かること

## 動作確認手順（行政マニュアル／ナレッジ台帳）

1. Supabase SQL Editor で次を順に実行する
   - `supabase/migrations/20260715090000_knowledge_documents.sql`
   - `supabase/migrations/20260715220000_knowledge_sync_announcements.sql`
   - `supabase/migrations/20260719060000_knowledge_watch_index.sql`（一覧監視・ETag・item_key）
   - `supabase/migrations/20260719080000_knowledge_change_drafts.sql`（スナップショット・差分ドラフト・通知先）
2. 運営オペレータ（`profiles.is_operator = true` または `OPERATOR_EMAILS`）でログインする
3. [http://localhost:3000/admin/rules/documents](http://localhost:3000/admin/rules/documents) を開く（旧URL `/admin/documents` も同画面へリダイレクト）
4. マニュアルを登録する
   - **PDF直リンク（file）**: 監視用PDF直リンク、またはPDFアップロード
   - **新着一覧（index）**: 一覧ページURL + 記事1件を指すCSSセレクタ（必須）
5. 「今すぐ同期」または「今すぐ一括同期」で取得を試す
   - file: 成功して内容が変わった場合 → 承認待ちドラフト作成（施設向けお知らせは承認後）
   - file: 同期成功時に Storage `knowledge-snapshots` へ抽出テキストが保存されること（Supabase Storage で確認）
   - MIME エラー（`text/plain; charset=utf-8 is not supported`）時は `20260802070000_knowledge_snapshots_mime.sql` を適用し、アプリは `text/plain` でアップロードすること
   - Gemini 未設定時も「AI整理なし」の pending ドラフトが `knowledge_document_change_drafts` に残ること
   - index: 初回はベースライン登録のみ（お知らせなし）。2回目以降の新着でお知らせ
   - 抽出0件（index）: 「要対応」にセレクタ破損として出ること
   - 失敗・疑い: 「要対応」。`OPERATOR_EMAILS` へ Resend メール（キー設定時）
6. 既存登録マニュアルの初回スナップショット（遡及）:
   ```bash
   npm run backfill:knowledge-snapshots
   ```
7. 定期実行（本番）: Vercel Cron `0 15 * * *`（UTC＝毎日0:00 JST頃）→ `/api/cron/knowledge-sync`
   - **本番に `CRON_SECRET` が無いと毎回 401 で同期されません**（要設定）
   - ローカル確認例:
     ```bash
     curl -X POST http://localhost:3000/api/cron/knowledge-sync \
       -H "Authorization: Bearer $CRON_SECRET"
     ```
8. 設定画面の運営カードから「ルール設定」へ遷移できること（公開情報監視・マニュアル変更の承認はルール設定内）
9. 変更承認: [http://localhost:3000/admin/document-changes](http://localhost:3000/admin/document-changes)
   - ハッシュ変更後に承認待ちが表示されること
   - 「要精査」案件は理由10文字以上がないと承認できないこと
   - 承認後にダッシュボード「お知らせ」が増えること
   - `/admin/rules/documents` ヘッダーの「変更を承認する」バッジ件数が減ること

本番投入時の環境変数・Storage・確認手順の詳細は  
[docs/OPERATIONS_STEP3.md](docs/OPERATIONS_STEP3.md) を参照してください。

## 動作確認手順（公開情報マスタ：自治体別）

1. マイグレーションを適用する
   - `supabase/migrations/20260720120000_rule_engine.sql`（未適用の場合）
   - `supabase/migrations/20260720130000_rule_source_urls.sql`（rule_sources 拡張）
2. 初期データを投入する
   ```bash
   npm run seed:rule-sources
   ```
   - `supabase/seeds/rule_source_urls.json` を編集して URL を追記し、再実行で UPSERT されること
   - 国・神奈川県＋横浜/鎌倉/藤沢/茅ヶ崎 × 6カテゴリが入ること（逗子市は対象外）
3. 運営アカウントで市ルールブック（例: `/admin/rules/regulatory/kawasaki`）の「自治体ルール設定」を開く
4. 国／県／市の折りたたみで公開情報の追加・修正・削除・確認済み化ができること
5. （任意）横断画面 `/admin/rules/source-urls` は「日常は市ルールブックへ」案内が出ること
6. SQL で確認する例:
   ```sql
   SELECT j.name, rs.material_category, rs.title,
          rs.parent_page_url, rs.direct_file_url, rs.human_review_status
   FROM rule_sources rs
   JOIN rule_jurisdictions j ON j.id = rs.jurisdiction_id
   WHERE rs.material_category IS NOT NULL
   ORDER BY j.sort_order, rs.priority;
   ```

## 動作確認手順（マスタールールエンジン DB）

画面は未実装。DB 骨格と湘南5市シードのみ。

1. Supabase SQL Editor で `supabase/migrations/20260720120000_rule_engine.sql` を実行する  
   （事前に `knowledge_documents` / `knowledge_document_change_drafts` マイグレーション適用済みであること）
2. 次が存在することを確認する
   - テーブル: `rule_jurisdictions` / `rule_sources` / `rule_sets` / `audit_items` / `ai_check_rules` / `ai_check_rule_versions`
3. シード確認例（SQL Editor）:
   ```sql
   SELECT code, level, name, is_supported
   FROM rule_jurisdictions
   ORDER BY sort_order, code;

   SELECT rs.title, j.name AS city, rs.service_type, rs.status, rs.fiscal_year
   FROM rule_sets rs
   JOIN rule_jurisdictions j ON j.id = rs.jurisdiction_id
   ORDER BY j.sort_order;
   ```
   - 国・神奈川県・横浜/藤沢/鎌倉/茅ヶ崎があること（逗子市は管轄マスタに残るが公開情報 seed 対象外）
   - 5市の訪問介護セットが `draft` であること（監査項目は空でよい）
4. 施設ユーザーでは読めず、運営（`is_operator`）のみ参照できること（RLS）

## 動作確認手順（ルール設定：利用設定／監視状況）

> 2026-08-09：入口は **利用設定**（`/admin/rules/setup`）と **監視状況**（`/admin/rules/monitoring`）の2本。詳細は [docs/ルールブック構想.md](docs/ルールブック構想.md)。

構想の正：[docs/ルールブック構想.md](docs/ルールブック構想.md)

1. 上記ルールエンジン DB マイグレーション適用済みであること
2. 運営アカウントでログインする
3. 設定 → 「ルール設定」または [http://localhost:3000/admin/rules](http://localhost:3000/admin/rules)
4. 左メニューが「利用設定／監視状況」であること
5. `/admin/rules` が利用設定（`/admin/rules/setup`）へリダイレクトすること
6. 利用設定から訪問介護 → ルールブック作成、および国・県／自治体へ進めること
7. 判定ルールは「ルールブック作成」で下書き→確定できること（裏方の国・県／市の判定ルール管理も残る）
8. 監視状況でエラー印 → 詳細、根拠情報でリンクを直す／差分ありならルールブックを作り直すへ進めること
9. `/admin/rules/more`・`/admin/rules/jobs` が監視状況へリダイレクトすること。`/admin/rules/services` がサービスマスタであること
10. findings のレビューコンソール（`/admin`）や Stripe には影響しないこと

詳細な操作説明：[docs/チェック設定ホーム操作マニュアル.md](docs/チェック設定ホーム操作マニュアル.md)

## 動作確認手順（Phase1 改訂 IA・原本保持）

確定事項の正：[docs/PHASE1_REDESIGN.md](docs/PHASE1_REDESIGN.md)  
**本番セットアップの実行チェックリスト**：[docs/OPERATIONS_PHASE1.md](docs/OPERATIONS_PHASE1.md)（マイグレーション → シード → スモーク）

1. Supabase SQL Editor で次を実行する
   - `supabase/migrations/20260725060000_document_original_retention.sql`
   - `supabase/migrations/20260725070000_phase1_kawasaki_jurisdiction.sql`
   - `supabase/migrations/20260727100000_announcements_seen_at.sql`（お知らせ未読バッジ用）
2. （任意）川崎の公開情報 seed: `npm run seed:rule-sources`
3. ログイン後、サイドバーに次があること
   - 運用AI監査 / あとで確認 / 監査結果
   - お知らせは運用AI監査内（直近3件）。**未読があるとき**「運用AI監査」にバッジ（一覧を開くと消える）
   - 法令AI監査・運営AI監査は「準備中」
   - 設定（事業所情報の確認。運営は「運営管理」からルール設定へ）
   - **月末の確認・月次レポートが主导線に出ない**こと
   - **お知らせが独立メニューに出ない**こと
   - **サイドバーに「初期設定」が無い**こと
4. モバイルのハンバーガーに「使い方」があること（初期設定・設定・アップロードは無し）
5. 「書類をアップロードする」→ 同意チェックなしでは開始できないこと
6. 「再確認のため原本を最大7日間残す」はデフォルトOFFであること
7. 同意して監査開始 → 結果画面の優先度が「緊急／要改善／推奨」であること
8. 結果画面に匿名化の注意文があること
9. 設定の事業所情報に事業所名・サービス種別・自治体・役割が表示されること（自治体は「○○のローカルルールでチェックします」）
10. （モック時）指摘に氏名・電話が残らず「利用者A」「[電話番号]」等になること（`DIFY_MOCK=1`）
11. 適用ルール版パネルに、対象自治体・書類種別に合う承認済みの頻出観点ルールが出ること（従来の基本突合だけに絞る検証は `CHECK_RULES_SCOPE=phase1`）
12. 運営で頻出観点ルールを投入する:
    - `/admin/rules/ai-rules` → 頻出観点ルールの一括登録ボタン
    - または `SEED_OPERATOR_PROFILE_ID=<profiles.id> npm run seed:phase1-ai-rules`
    - 先に監査項目の訪問介護テンプレート登録が必要
13. `/settings` に「あなたの表示名」があり、事業所名とは別に変更できること
14. 運営アカウントで設定の「運営管理」に「レビューコンソール」「ルール設定」があり `/admin/rules` が開けること
15. `/billing-reconcile` で請求CSV突合できること
16. `/guide` に使い方要約と注意事項があること
17. 管理者は `/announcements` から事業所お知らせを投稿できること（一覧が上・投稿フォームが下）
18. `/announcements` を開くとお知らせバッジが消えること（未読があるときのみバッジ）
19. 運用AI監査（`/`）で次を確認すること
    - お知らせ・今日やること・最近の指摘に「すべて見る」（枠付きボタン）があり、押せる見た目であること
    - 今日やることの補足が「未完了書類と優先対応を表示」
    - 最近の指摘の補足が「重要な過去の改善指摘を表示」
20. スマホ実機で下部タブが画面端から少し内側・上にあり、左右端のタブも押しやすいこと
21. 原本削除 Cron（任意）:
    ```bash
    curl -X POST "http://localhost:3000/api/cron/purge-document-originals" \
      -H "Authorization: Bearer $CRON_SECRET"
    ```

## 動作確認手順（公開情報登録→公開情報監視）

1. 運営アカウントで訪問介護の根拠情報（`/admin/rules/services/homecare/sources`）を開く
2. カバー率と、未登録の根拠カテゴリへの追加案内が出ること。国／県／市のいずれかで「資料を追加する」→ 「読むPDF」または「参考リンク（HTML）」を選んで資料名とURLを登録する
3. 読むPDFで本文が取れたときは緑の案内、取れないときは赤の案内になること。HTMLは「リンク集に載せました」となり、抽出・本文なしに入らないこと。大きい公式PDF（介護報酬改定Q&A Vol.1 など100ページ超）でも本文ありが付くこと。本文なしのときは根拠情報の「本文を取り直す」（本番反映後）で再取得できること
4. 監視状況（`/admin/rules/monitoring`）にエラー／差分／正常のサマリとリストが出ること（読むPDFのみ）。PDFは取れたが本文0件のときは正常にせずエラーになり、根拠情報の「本文を取り直す」で再同期できること。日本／未確認は「国の資料で未確認」であり、本文ありではないこと
5. 差分ありの詳細から「原文を開く」「確認してルールブックを作り直す」へ進めること。作り直し先は訪問介護の「ルールブック作成」（市が付くこと）。エラーの詳細から「根拠情報でリンクを直す」へ進めること
6. 「ルールブック作成」に `?reason=source-changed` で開くと、作り直しの案内が出ること
7. NG・差分ありをタップすると詳細が開くこと
8. 読むPDFは `rule_sources.knowledge_document_id` が埋まっていること（SQLまたは編集画面）。HTMLは台帳を作らないこと
9. 根拠情報の一覧が「読む資料」と「リンク集」に分かれていること。本文なしは読むPDFだけに出て、「本文を取り直す」があること。各資料に「修正する」「ルールブックへ追加」があること
10. 根拠情報に自動監視の注意文とカバー率が出ること
11. 「削除する」で一覧から外れ（`status=archived`）、再表示されないこと
12. ヘッダー右上に「ログイン中の事業所」と、設定した表示名が出ること
13. `/admin/rules/jobs`・`/admin/rules/more` が監視状況へリダイレクトすること

## 動作確認手順（アップロード導線・ナビ）

1. 「運用AI監査」→「書類をアップロードする」で `/check/upload` を開く
2. サイドバー／下部タブで **運用AI監査** だけが選択中であること（**監査結果に色がつかない**こと）
3. 「何をチェックしますか？」の各カードが「〇〇をチェックする」＋「〇〇をアップロードしてください」であること
4. 種類を選ぶと次画面の表題が同じ「〇〇をチェックする」になり、アップロード案内が表示されること
5. チェック完了後の結果画面（`/check/[id]`）では **監査結果** が選択中になること

## 動作確認手順（ナビ名称・表題の統一）

1. サイドバー／下部タブに「監査結果」（短縮「結果」）とあること（「監査結果の履歴」ではない）
2. `/audit-history` の表題が「監査結果」であること
3. 設定（運営アカウント）の運営向けに「レビューコンソールを開く」「ルール設定」のみあること（公開情報監視・マニュアル変更の承認の直リンクが無いこと）
4. レビューコンソール（`/admin`）右上も「ルール設定」「月次レポート管理」のみであること
5. 主要画面（運用AI監査・あとで確認・監査結果・設定・お知らせ・使い方）の表題サイズが揃っていること（h1: 2xl / md:3xl）

## 動作確認手順（ログインロックアウト）

本番（Vercel）向けの詳しい手順（素人向け・監査ログ確認・admin/ops解除含む）:
[docs/OPERATIONS_LOGIN_LOCKOUT.md](docs/OPERATIONS_LOGIN_LOCKOUT.md)

要約:

1. Supabase SQL Editor で `supabase/migrations/20260719070000_login_lockout.sql` を実行する
2. 登録済みアカウントで、わざと誤パスワードを5回連続入力する
   - 5回目以降「ログイン試行が制限されています」と表示されること
   - 正しいパスワードでも、ロック中は入れないこと
3. 未登録メールで何度失敗しても、登録済みアカウントのカウンタが増えないこと（別アカウントで確認）
4. 設定画面の「ログインセキュリティ」から、同一事業所の管理者が解除できること
5. 権限テスト:
   ```bash
   npm run test:lockout
   ```
   - 他事業所相当の解除が 403 になること
6. CLI 解除（任意）:
   ```bash
   npm run unlock-user -- --email=user@example.com
   ```

### 監視の作法（実装済み）

- 条件付きGET（ETag / If-Modified-Since）
- 対象間の待機は最低5秒（`KNOWLEDGE_SYNC_INTERVAL_SEC`）
- User-Agent に連絡先を付与（`KNOWLEDGE_SYNC_CONTACT_EMAIL` または `KNOWLEDGE_SYNC_USER_AGENT`）
- 1対象の失敗は他対象を止めない（アラート記録して continue）
- index の抽出0件は「新着なし」ではなくセレクタ破損
- file 監視: PDFテキストを `knowledge-snapshots`（private）へ保存（ソフト上限2MBで切り詰め）
## 主なルート

| パス | 内容 |
|------|------|
| `/login` | ログイン |
| `/signup` | アカウント作成 |
| `/onboarding` | 初回オンボーディング |
| `/invite/[token]` | 招待受諾 |
| `/` | 運用AI監査（お知らせ・今日やること・最近の指摘） |
| `/announcements` | お知らせ一覧・事業所投稿（管理者） |
| `/guide` | 使い方・注意事項 |
| `/audit-history` | 監査結果と対応状況 |
| `/audit/operations` | `/` へリダイレクト |
| `/audit/legal` | 法令AI監査（準備中） |
| `/audit/management` | 運営AI監査（準備中） |
| `/later` | あとで確認リスト |
| `/documents` | （旧）→ `/audit-history` へリダイレクト |
| `/check/upload` | 監査書類アップロード（同意・7日オプション） |
| `/check/[documentId]` | チェック結果（適用ルール版・基準日つき） |
| `/check/demo/[scenario]` | 結果画面デモ（success / parse_error / empty） |
| `/reconcile` | 月末の確認（Phase1では主导線外） |
| `/attendance/import` | 介護ソフトCSV取込（主导線外） |
| `/attendance` | 勤怠の矛盾検知（主导線外） |
| `/billing-reconcile` | 請求CSV突合（主导線外） |
| `/alerts` | 期限アラート（主导線外） |
| `/reports` | 月次レポート（主导線外） |
| `/pricing` | 料金プラン（公開） |
| `/admin` | 運営レビューコンソール（運営のみ） |
| `/admin/rules` | ルール設定（→利用設定） |
| `/admin/rules/setup` | 利用設定（サービス設定） |
| `/admin/rules/monitoring` | 監視状況 |
| `/admin/rules/services/[slug]` | サービス（国・県／自治体） |
| `/admin/rules/pending` | （旧）利用設定へリダイレクト |
| `/admin/rules/manual` | （旧）利用設定へリダイレクト |
| `/admin/rules/services/[slug]/national-prefecture/rules` | 国・県の判定ルール管理（共通） |
| `/admin/rules/services/[slug]/municipalities/[city]/rules` | 市の判定ルール管理 |
| `/admin/rules/audit-items` | 訪問介護ハブへリダイレクト |
| `/admin/rules/history` | ルール管理のルール一覧へリダイレクト |
| `/admin/rules/notifications` | 公開情報台帳管理（監視状況から） |
| `/admin/rules/more` | 監視状況へリダイレクト |
| `/admin/rules/jobs` | 監視状況へリダイレクト |
| `/admin/rules/documents` | 公開情報監視（監視状況から） |
| `/admin/reports` | 月次レポート管理（管理者のみ） |
| `/settings` | 設定・招待・ログアウト |
| `/styleguide` | デザインシステム確認用 |

## スクリプト

```bash
npm run dev         # 開発サーバー
npm run build       # 本番ビルド
npm run start       # 本番起動
npm run lint        # ESLint
npm run test        # 単体テスト（矛盾検知・請求突合）
npm run test:rls     # RLS事業所分離テスト
npm run test:check   # AIチェック モック／パーステスト
npm run test:review  # 人間レビュー公開制御テスト
npm run seed:rule-sources  # 自治体別公開情報マスタの初期投入
```
