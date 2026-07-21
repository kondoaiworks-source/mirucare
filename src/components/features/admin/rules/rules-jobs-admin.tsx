"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { listRuleJobsAction } from "@/app/actions/rule-engine"
import type { KnowledgeDocument, KnowledgeSyncAlert } from "@/types/database"
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

type DocRow = Pick<
  KnowledgeDocument,
  | "id"
  | "title"
  | "watch_kind"
  | "last_sync_status"
  | "last_checked_at"
  | "last_ok_at"
  | "last_error"
  | "status"
>

function formatDt(iso: string | null | undefined) {
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

function statusLabel(s: KnowledgeDocument["last_sync_status"]) {
  switch (s) {
    case "ok":
      return "更新あり"
    case "unchanged":
      return "変更なし"
    case "failed":
      return "失敗"
    case "suspicious":
      return "要確認"
    case "selector_broken":
      return "セレクタ破損"
    default:
      return "未実行"
  }
}

export function RulesJobsAdmin() {
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [alerts, setAlerts] = useState<KnowledgeSyncAlert[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listRuleJobsAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      return
    }
    setDocuments(result.data?.documents ?? [])
    setAlerts(result.data?.alerts ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb items={[{ label: "ジョブ監視" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark">ジョブ監視</h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          行政資料の自動同期の結果を確認します。問題があれば行政資料画面で対応してください。
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
            <CardTitle className="text-lg">未解消アラート</CardTitle>
            <CardDescription className="text-base tabular-nums">
              {alerts.length} 件
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="lg" className="min-h-11">
            <Link href="/admin/rules/documents">行政資料で対応する</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 ? (
            <p className="text-base text-muted-foreground">未解消アラートはありません。</p>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border p-3 text-base leading-relaxed"
              >
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge variant="destructive" className="rounded-lg">
                    {a.kind}
                  </Badge>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDt(a.created_at)}
                  </span>
                </div>
                <p>{a.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">監視対象の最終同期</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>マニュアル</TableHead>
                <TableHead>方式</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>最終確認</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>
                    {doc.watch_kind === "index" ? "一覧" : "PDF"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        doc.last_sync_status === "failed" ||
                        doc.last_sync_status === "suspicious" ||
                        doc.last_sync_status === "selector_broken"
                          ? "destructive"
                          : "outline"
                      }
                      className="rounded-lg"
                    >
                      {statusLabel(doc.last_sync_status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {formatDt(doc.last_checked_at)}
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    監視対象のマニュアルがありません。
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
