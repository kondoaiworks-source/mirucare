import { NextResponse } from "next/server"

type RouteContext = {
  params: { id: string }
}

/**
 * ナレッジ台帳 個別操作（アーカイブ等）。中身はモック。
 */
export async function PATCH(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => ({}))) as {
    status?: string
  }
  const id = context.params.id

  console.log("[api/admin/knowledge-documents] PATCH archive (mock)", {
    id,
    status: body.status ?? "archived",
  })

  return NextResponse.json({
    ok: true,
    data: {
      id,
      status: body.status === "active" ? "active" : "archived",
    },
  })
}
