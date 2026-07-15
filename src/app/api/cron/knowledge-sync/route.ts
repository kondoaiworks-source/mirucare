import { NextResponse } from "next/server"
import { syncAllKnowledgeDocuments } from "@/lib/knowledge/sync"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 行政マニュアルPDF直リンクの定期同期（1日1回想定）
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
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
