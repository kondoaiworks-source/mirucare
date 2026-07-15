import { NextResponse } from "next/server"
import { requireOperator } from "@/lib/operator"
import { archiveKnowledgeDocumentAction } from "@/app/actions/knowledge-documents"

type RouteContext = {
  params: { id: string }
}

export async function PATCH(request: Request, context: RouteContext) {
  const op = await requireOperator()
  if ("error" in op) {
    return NextResponse.json({ ok: false, error: op.error }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string
  }
  const id = context.params.id

  if (body.status === "archived") {
    const result = await archiveKnowledgeDocumentAction(id)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      )
    }
    return NextResponse.json({
      ok: true,
      data: { id, status: "archived" },
    })
  }

  return NextResponse.json(
    { ok: false, error: "未対応の操作です。" },
    { status: 400 }
  )
}
