"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { listRuleNotificationsAction } from "@/app/actions/rule-engine"
import type {
  KnowledgeDocument,
  KnowledgeDocumentChangeDraft,
} from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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

type Row = KnowledgeDocumentChangeDraft & {
  knowledge_documents: Pick<KnowledgeDocument, "id" | "title"> | null
}

function formatDt(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function RulesNotificationsAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listRuleNotificationsAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.drafts ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb items={[{ label: "自治体ルール変更通知" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark">
          自治体ルール変更通知
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          自治体ルールの変更を感知して差分承認の依頼を通知します。詳細確認・承認は差分承認画面で行います。
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
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">自治体ルール変更の一覧</CardTitle>
            <CardDescription className="text-base">
              詳細確認・承認は差分承認画面で行います。
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/admin/document-changes">承認画面を開く</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>検知日時</TableHead>
                <TableHead>マニュアル</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>メール送信</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {formatDt(row.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {row.knowledge_documents?.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-lg">
                      {row.status === "pending"
                        ? "差分承認待ち"
                        : row.status === "approved"
                          ? "承認済"
                          : "差し戻し"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {row.notified_at ? formatDt(row.notified_at) : "未送信/失敗"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    通知対象のドラフトはまだありません。
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
