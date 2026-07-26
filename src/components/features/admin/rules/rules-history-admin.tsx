"use client"

import { useCallback, useEffect, useState } from "react"
import { listRuleVersionHistoryAction } from "@/app/actions/rule-engine"
import type { AiCheckRule, AiCheckRuleVersion } from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"

const REVIEW_LABEL: Record<AiCheckRuleVersion["review_status"], string> = {
  draft: "下書き",
  pending_review: "了承待ち",
  approved: "承認済",
  rejected: "差し戻し",
}

type Row = AiCheckRuleVersion & {
  ai_check_rules: Pick<AiCheckRule, "id" | "title" | "code"> | null
}

function formatDt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function RulesHistoryAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listRuleVersionHistoryAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.rows ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb items={[{ label: "更新履歴" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark">更新履歴</h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          AI判定ルールの作成・承認の履歴です（新しい順）。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">履歴</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>ルール</TableHead>
                <TableHead>版</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>概要</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {formatDt(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {row.ai_check_rules?.title ?? "—"}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.ai_check_rules?.code}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">v{row.version_no}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-lg">
                      {REVIEW_LABEL[row.review_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {row.change_summary || row.review_reason || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    履歴はまだありません。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
