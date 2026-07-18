import { NextResponse } from "next/server"
import { syncAllKnowledgeDocuments } from "@/lib/knowledge/sync"

export const runtime = "nodejs"
/** 対象間5秒待機のため、件数増に備え延長（Hobby は上限に注意） */
export const maxDuration = 300

/**
 * 行政マニュアルの定期同期（file=PDF直リンク / index=一覧ページ）
 * Authorization: Bearer ${CRON_SECRET}
 *
 * 注意: CRON_SECRET 未設定時は常に 401（Vercel Cron も失敗する）。
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization") ?? ""
  if (!secret) {
    console.error("[cron/knowledge-sync] CRON_SECRET_missing")
    return NextResponse.json(
      { error: "Unauthorized", reason: "CRON_SECRET_missing" },
      { status: 401 }
    )
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { results, checked } = await syncAllKnowledgeDocuments()
    const summary = {
      ok: true,
      checked,
      okCount: results.filter((r) => r.status === "ok").length,
      unchanged: results.filter((r) => r.status === "unchanged").length,
      failed: results.filter((r) => r.status === "failed").length,
      suspicious: results.filter((r) => r.status === "suspicious").length,
      selectorBroken: results.filter((r) => r.status === "selector_broken")
        .length,
    }
    console.log("[cron/knowledge-sync]", summary)
    return NextResponse.json({ ...summary, results })
  } catch (error) {
    console.error("[cron/knowledge-sync]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ナレッジ同期に失敗しました。",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}
