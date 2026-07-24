import { NextResponse } from "next/server"
import { purgeDueDocumentOriginals } from "@/lib/documents/retention"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 原本ファイルの期限削除（keep 7日オプション分）
 * Authorization: Bearer ${CRON_SECRET}
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization") ?? ""
  if (!secret) {
    console.error("[cron/purge-document-originals] CRON_SECRET_missing")
    return NextResponse.json(
      { error: "Unauthorized", reason: "CRON_SECRET_missing" },
      { status: 401 }
    )
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await purgeDueDocumentOriginals(200)
    console.log("[cron/purge-document-originals]", result)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[cron/purge-document-originals]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "原本削除に失敗しました。",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}
