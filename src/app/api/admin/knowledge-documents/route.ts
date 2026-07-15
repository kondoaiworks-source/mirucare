import { NextResponse } from "next/server"
import { requireOperator } from "@/lib/operator"
import {
  listKnowledgeDocumentsAction,
  registerKnowledgeDocumentAction,
} from "@/app/actions/knowledge-documents"
import type { JurisdictionLevel } from "@/types/database"

/**
 * 互換用 REST。管理画面は server actions を優先利用。
 */
export async function GET() {
  const op = await requireOperator()
  if ("error" in op) {
    return NextResponse.json({ ok: false, error: op.error }, { status: 403 })
  }
  const result = await listKnowledgeDocumentsAction()
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, data: result.data })
}

export async function POST(request: Request) {
  const op = await requireOperator()
  if ("error" in op) {
    return NextResponse.json({ ok: false, error: op.error }, { status: 403 })
  }

  const form = await request.formData()
  const title = String(form.get("title") ?? "")
  const jurisdictionLevel = String(
    form.get("jurisdictionLevel") ?? "国"
  ) as JurisdictionLevel
  const regionName = String(form.get("regionName") ?? "")
  const applicableYear = Number(form.get("applicableYear"))
  const sourceUrl = String(form.get("sourceUrl") ?? "")
  const file = form.get("file")

  let fileBase64: string | undefined
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer())
    fileBase64 = buf.toString("base64")
  }

  const result = await registerKnowledgeDocumentAction({
    title,
    jurisdictionLevel:
      jurisdictionLevel === "都道府県" || jurisdictionLevel === "市区町村"
        ? jurisdictionLevel
        : "国",
    regionName,
    applicableYear: Number.isFinite(applicableYear)
      ? applicableYear
      : new Date().getFullYear(),
    sourceUrl: sourceUrl || undefined,
    fileBase64,
    fileName: file instanceof File ? file.name : undefined,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true, data: result.data })
}
