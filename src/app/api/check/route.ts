import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runDocumentCheck } from "@/lib/check/run-check"
import { assertCanStartChecks } from "@/app/actions/billing"
import type { MockScenario } from "@/lib/dify/types"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/check
 * body: { documentId: string, mockScenario?: "success"|"parse_error"|"empty" }
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          error:
            "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
        },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          error:
            "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
        },
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => null)) as {
      documentId?: string
      mockScenario?: MockScenario
    } | null

    const documentId = body?.documentId?.trim()
    if (!documentId) {
      return NextResponse.json(
        { error: "書類が指定されていません。" },
        { status: 400 }
      )
    }

    // 自事業所の書類か確認（RLS）
    const { data: doc } = await supabase
      .from("documents")
      .select("id, status")
      .eq("id", documentId)
      .eq("organization_id", profile.organization_id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!doc) {
      return NextResponse.json(
        { error: "書類が見つかりません。" },
        { status: 404 }
      )
    }

    // すでに checking 以降なら再実行を許可（上限は start 時に判定済み）
    // uploaded のまま直接呼ばれた場合のみプラン判定
    if (doc.status === "uploaded") {
      const quota = await assertCanStartChecks(profile.organization_id)
      if (!quota.allowed) {
        return NextResponse.json(
          { error: quota.message ?? "現在のプランではチェックできません。" },
          { status: 403 }
        )
      }
    }

    const result = await runDocumentCheck({
      documentId,
      organizationId: profile.organization_id,
      mockScenario: body?.mockScenario,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "チェックに失敗しました。" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      findingCount: result.findingCount ?? 0,
      usedFallback: result.usedFallback ?? false,
      reviewStatus: result.reviewStatus,
    })
  } catch {
    return NextResponse.json(
      {
        error:
          "チェック処理中に問題が発生しました。しばらくしてから再度お試しください。",
      },
      { status: 500 }
    )
  }
}
