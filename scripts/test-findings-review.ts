/**
 * 人間レビュー：承認前はユーザーに指摘が見えないこと（受け入れ条件 [2]）
 *
 * 実行前提:
 * - マイグレーション ①〜⑦ 適用済み（特に findings + admin_review）
 * - .env.local に SUPABASE_URL / ANON / SERVICE_ROLE
 *
 * 実行:
 *   npm run test:review
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const anon =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  assert(url && anon && service, "Supabase 環境変数が不足しています")

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = Date.now()
  const email = `review-${stamp}@example.com`
  const password = "TestPass123!"

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "レビューテスト" },
  })
  assert(!createErr && created.user, `ユーザー作成失敗: ${createErr?.message}`)
  const user = created.user!

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  })
  assert(!signInErr, `ログイン失敗: ${signInErr?.message}`)

  const { data: orgId, error: onboardErr } = await client.rpc(
    "complete_onboarding",
    {
      p_name: `[レビューテスト]事業所-${stamp}`,
      p_service_type: "訪問介護",
      p_municipality: "横浜市",
      p_skip_municipality: false,
    }
  )
  assert(!onboardErr && orgId, `オンボーディング失敗: ${onboardErr?.message}`)

  // 人間レビュー必須に設定
  const { error: orgUpdateErr } = await admin
    .from("organizations")
    .update({ skip_finding_review: false })
    .eq("id", orgId)
  assert(!orgUpdateErr, `事業所更新失敗: ${orgUpdateErr?.message}`)

  // 書類をサービスロールで作成
  const { data: doc, error: docErr } = await admin
    .from("documents")
    .insert({
      organization_id: orgId,
      uploaded_by: user.id,
      doc_type: "ケアプラン",
      file_path: `test/${stamp}/dummy.pdf`,
      original_name: "dummy.pdf",
      mime_type: "application/pdf",
      file_size: 100,
      status: "reviewed",
    })
    .select("id")
    .single()
  assert(!docErr && doc, `書類作成失敗: ${docErr?.message}`)

  // pending の指摘を挿入
  const { data: finding, error: findErr } = await admin
    .from("findings")
    .insert({
      document_id: doc.id,
      organization_id: orgId,
      severity: "high",
      title: "テスト指摘（未承認）",
      description: "承認前は見えてはいけません",
      status: "open",
      review_status: "pending",
      sort_order: 0,
    })
    .select("id")
    .single()
  assert(!findErr && finding, `指摘作成失敗: ${findErr?.message}`)

  // ユーザークライアントからは見えないこと
  const { data: before, error: beforeErr } = await client
    .from("findings")
    .select("id, title, review_status")
    .eq("document_id", doc.id)

  assert(!beforeErr, `SELECT失敗: ${beforeErr?.message}`)
  assert(
    (before ?? []).length === 0,
    `FAIL: 未承認の指摘がユーザーに見えています (${JSON.stringify(before)})`
  )
  console.log("PASS: pending の指摘はユーザー SELECT で 0 件")

  // 承認
  const { error: approveErr } = await admin
    .from("findings")
    .update({
      review_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", finding.id)
  assert(!approveErr, `承認失敗: ${approveErr?.message}`)

  const { data: after, error: afterErr } = await client
    .from("findings")
    .select("id, title, review_status")
    .eq("document_id", doc.id)

  assert(!afterErr, `承認後SELECT失敗: ${afterErr?.message}`)
  assert(
    (after ?? []).length === 1 && after![0].id === finding.id,
    `FAIL: 承認後に指摘が見えない (got ${JSON.stringify(after)})`
  )
  assert(
    after![0].review_status === "approved",
    "FAIL: review_status が approved ではありません"
  )
  console.log("PASS: approved 後はユーザーに 1 件見える")

  // 却下は見えないこと
  const { data: rejected, error: rejInsErr } = await admin
    .from("findings")
    .insert({
      document_id: doc.id,
      organization_id: orgId,
      severity: "mid",
      title: "テスト指摘（却下）",
      description: "却下は見えてはいけません",
      status: "open",
      review_status: "rejected",
      sort_order: 1,
    })
    .select("id")
    .single()

  if (rejInsErr) {
    // rejected 未マイグレーション時はスキップ
    console.log(
      "SKIP: rejected ステータス未適用（20260711060000_admin_review.sql を実行してください）:",
      rejInsErr.message
    )
  } else {
    const { data: afterReject } = await client
      .from("findings")
      .select("id")
      .eq("document_id", doc.id)
    assert(
      (afterReject ?? []).every((r) => r.id !== rejected!.id),
      "FAIL: 却下した指摘がユーザーに見えています"
    )
    console.log("PASS: rejected の指摘はユーザーに見えない")
  }

  // クリーンアップ
  await admin.from("findings").delete().eq("document_id", doc.id)
  await admin.from("documents").delete().eq("id", doc.id)
  await admin.from("profiles").delete().eq("id", user.id)
  await admin.from("organizations").delete().eq("id", orgId)
  await admin.auth.admin.deleteUser(user.id)

  console.log("PASS: 人間レビュー公開制御テスト成功")
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error)
  process.exit(1)
})
