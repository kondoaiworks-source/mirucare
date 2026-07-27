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
import { AlertTriangle, Plus, RefreshCw } from "lucide-react"
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

type Props = {
  /** 監視トラブルページに埋め込むとき true（見出し・パンくずを出さない） */
  embedded?: boolean
}

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

const MANUAL_REGISTER_HREF = "/admin/rules/documents?register=1"

export function RulesJobsAdmin({ embedded = false }: Props) {
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [alerts, setAlerts] = useState<KnowledgeSyncAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await listRuleJobsAction()
      if (!result.ok) {
        setError(result.error ?? "取得に失敗しました。")
        return
      }
      setDocuments(result.data?.documents ?? [])
      setAlerts(result.data?.alerts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      {embedded ? null : (
        <div>
          <AdminBreadcrumb
            items={[
              { label: "監視トラブル", href: "/admin/rules/more" },
              { label: "同期の結果" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            同期の結果
          </h1>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            連携したマニュアルの自動取得が成功したか確認します。問題があれば手動管理から対応してください。
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="min-h-11">
          <Link href={MANUAL_REGISTER_HREF}>
            <Plus className="size-4" aria-hidden />
            手動管理
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            className={loading ? "size-4 animate-spin" : "size-4"}
            aria-hidden
          />
          再読み込み
        </Button>
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
            <Link href={MANUAL_REGISTER_HREF}>手動管理へ</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && alerts.length === 0 ? (
            <p className="text-base text-muted-foreground">読み込み中…</p>
          ) : null}
          {!loading && alerts.length === 0 ? (
            <p className="text-base text-muted-foreground">
              未解消アラートはありません。
            </p>
          ) : null}
          {alerts.map((a) => (
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
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">監視対象の最終同期</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            URLの登録は市ルールブックの「自治体ルール設定」で行います。こちらは結果の確認用です。
          </CardDescription>
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
              {!loading && documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    監視対象のマニュアルがありません。市ルールブックでPDF直リンクを登録してください。
                  </TableCell>
                </TableRow>
              ) : null}
              {loading && documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    読み込み中…
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
