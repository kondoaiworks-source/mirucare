import { NextResponse } from "next/server"
import type { KnowledgeDocument } from "@/types/database"

/**
 * ナレッジ台帳 API（基盤モック）。
 * 本番では requireOperator + Supabase CRUD + Dify Knowledge API に差し替える。
 */

const MOCK_ROWS: KnowledgeDocument[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "指定居宅サービス等の事業の人員、設備及び運営に関する基準（抜粋）",
    jurisdiction_level: "国",
    region_name: null,
    applicable_year: 2026,
    dify_document_id: "dify-doc-national-2026",
    status: "active",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "神奈川県 実地指導マニュアル（訪問介護）",
    jurisdiction_level: "都道府県",
    region_name: "神奈川県",
    applicable_year: 2026,
    dify_document_id: "dify-doc-kanagawa-2026",
    status: "active",
    created_at: "2026-04-15T00:00:00.000Z",
    updated_at: "2026-04-15T00:00:00.000Z",
  },
]

export async function GET() {
  console.log("[api/admin/knowledge-documents] GET list (mock)")
  return NextResponse.json({ ok: true, data: { documents: MOCK_ROWS } })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const title = String(form.get("title") ?? "")
  const jurisdictionLevel = String(form.get("jurisdictionLevel") ?? "")
  const regionName = String(form.get("regionName") ?? "")
  const applicableYear = Number(form.get("applicableYear"))
  const file = form.get("file")

  console.log("[api/admin/knowledge-documents] POST register → Dify (mock)", {
    title,
    jurisdictionLevel,
    regionName: regionName || null,
    applicableYear,
    fileName: file instanceof File ? file.name : null,
    fileSize: file instanceof File ? file.size : null,
  })

  const now = new Date().toISOString()
  const document: KnowledgeDocument = {
    id: crypto.randomUUID(),
    title: title || "無題マニュアル",
    jurisdiction_level:
      jurisdictionLevel === "都道府県" || jurisdictionLevel === "市区町村"
        ? jurisdictionLevel
        : "国",
    region_name:
      jurisdictionLevel === "国" ? null : regionName.trim() || null,
    applicable_year: Number.isFinite(applicableYear)
      ? applicableYear
      : new Date().getFullYear(),
    dify_document_id: `dify-mock-${Date.now()}`,
    status: "active",
    created_at: now,
    updated_at: now,
  }

  return NextResponse.json({ ok: true, data: { document } })
}
