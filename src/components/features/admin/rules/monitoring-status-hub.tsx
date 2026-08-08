"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
} from "lucide-react"
import { listRuleJobsAction, listRuleNotificationsAction } from "@/app/actions/rule-engine"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
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
  buildLinkageMonitorEvents,
  type LinkageMonitorEvent,
} from "@/lib/rule-engine/linkage-monitoring"
import type { KnowledgeDocument, KnowledgeSyncAlert } from "@/types/database"
import { cn } from "@/lib/utils"

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
  | "jurisdiction_level"
  | "region_name"
>

const LAYER_ORDER = ["national", "prefecture", "municipality", "other"] as const
const LAYER_LABEL: Record<string, string> = {
  national: "国",
  prefecture: "県",
  municipality: "市区町村",
  other: "その他",
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

function resultMeta(result: LinkageMonitorEvent["result"]) {
  if (result === "ng") {
    return {
      label: "エラー",
      variant: "destructive" as const,
      Icon: CircleAlert,
    }
  }
  if (result === "diff") {
    return {
      label: "差分あり",
      variant: "secondary" as const,
      Icon: AlertTriangle,
    }
  }
  return {
    label: "正常",
    variant: "outline" as const,
    Icon: CheckCircle2,
  }
}

/**
 * 監視状況ハブ：国・自治体サマリとエラー詳細。
 */
export function MonitoringStatusHub() {
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [alerts, setAlerts] = useState<KnowledgeSyncAlert[]>([])
  const [drafts, setDrafts] = useState<
    Array<{
      id: string
      created_at: string
      ai_summary: string | null
      knowledge_documents: { id: string; title: string } | null
    }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobs, notes] = await Promise.all([
        listRuleJobsAction(),
        listRuleNotificationsAction(),
      ])
      if (!jobs.ok) {
        setError(jobs.error ?? "取得に失敗しました。")
        setDocuments([])
        setAlerts([])
      } else {
        setDocuments(jobs.data?.documents ?? [])
        setAlerts(jobs.data?.alerts ?? [])
      }
      if (notes.ok) {
        setDrafts(
          (notes.data?.drafts ?? [])
            .filter((d) => d.status === "pending")
            .map((d) => ({
              id: d.id,
              created_at: d.created_at,
              ai_summary: d.ai_summary,
              knowledge_documents: d.knowledge_documents
                ? {
                    id: d.knowledge_documents.id,
                    title: d.knowledge_documents.title,
                  }
                : null,
            }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const events = useMemo(
    () =>
      buildLinkageMonitorEvents({
        documents,
        alerts,
        drafts,
      }),
    [documents, alerts, drafts]
  )

  const counts = useMemo(() => {
    let ng = 0
    let diff = 0
    let ok = 0
    for (const e of events) {
      if (e.result === "ng") ng += 1
      else if (e.result === "diff") diff += 1
      else ok += 1
    }
    return { ng, diff, ok }
  }, [events])

  const byLayer = useMemo(() => {
    const map = new Map<string, LinkageMonitorEvent[]>()
    for (const key of LAYER_ORDER) map.set(key, [])
    for (const e of events) {
      const doc = documents.find((d) => d.id === e.documentId)
      const raw = doc?.jurisdiction_level ?? "other"
      const layer = (LAYER_ORDER as readonly string[]).includes(raw)
        ? raw
        : "other"
      map.get(layer)!.push(e)
    }
    return map
  }, [events, documents])

  const selected =
    events.find((e) => e.id === selectedId) ?? null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
            監視状況
          </h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            国・自治体ごとの監視結果を確認します。
          </p>
        </div>
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

      <section className="space-y-3" aria-labelledby="monitor-summary-heading">
        <h2
          id="monitor-summary-heading"
          className="text-xl font-bold text-primary-dark"
        >
          監視サマリ
        </h2>
        <p className="text-base text-muted-foreground">件数の一覧です。</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <AdminEqualCard
              title="エラー"
              description="同期失敗・要確認の件数"
              value={counts.ng}
              icon={CircleAlert}
              className={counts.ng > 0 ? "border-danger/30" : undefined}
            />
          </li>
          <li>
            <AdminEqualCard
              title="差分あり"
              description="更新検知・台帳確認の件数"
              value={counts.diff}
              icon={AlertTriangle}
            />
          </li>
          <li>
            <AdminEqualCard
              title="正常"
              description="変更なしで同期できた件数"
              value={counts.ok}
              icon={CheckCircle2}
            />
          </li>
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section
          className="space-y-4 lg:col-span-3"
          aria-labelledby="monitor-list-heading"
        >
          <div>
            <h2
              id="monitor-list-heading"
              className="text-xl font-bold text-primary-dark"
            >
              監視リスト
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              エラー印を押すと詳細を表示します。
            </p>
          </div>

          {LAYER_ORDER.map((layer) => {
            const rows = byLayer.get(layer) ?? []
            if (rows.length === 0) return null
            return (
              <div key={layer} className="space-y-2">
                <h3 className="text-base font-semibold text-primary-dark">
                  {LAYER_LABEL[layer]}
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    （{rows.length}）
                  </span>
                </h3>
                <ul className="space-y-2">
                  {rows.map((event) => {
                    const meta = resultMeta(event.result)
                    const Icon = meta.Icon
                    const doc = documents.find((d) => d.id === event.documentId)
                    const active = selected?.id === event.id
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(event.id)}
                          className={cn(
                            "flex w-full min-h-[4.5rem] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-subtle",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active && "border-primary/40 bg-primary/[0.03]"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-lg",
                              event.result === "ng" &&
                                "bg-danger/10 text-danger",
                              event.result === "diff" &&
                                "bg-warning/15 text-warning",
                              event.result === "ok" &&
                                "bg-primary/10 text-primary"
                            )}
                            aria-hidden
                          >
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 font-medium text-primary-dark">
                              {event.title}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                              {doc?.region_name || LAYER_LABEL[layer]}
                              {" · "}
                              {formatDt(event.checkedAt)}
                            </p>
                          </div>
                          <Badge
                            variant={meta.variant}
                            className="shrink-0 rounded-md"
                          >
                            {meta.label}
                          </Badge>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}

          {!loading && events.length === 0 ? (
            <Card className="rounded-xl shadow-subtle">
              <CardHeader>
                <CardTitle className="text-lg">監視対象がありません</CardTitle>
                <CardDescription className="text-base">
                  利用設定で根拠URL（PDF直リンク）を登録してください。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="min-h-11">
                  <Link href="/admin/rules/setup">利用設定を開く</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {loading && events.length === 0 ? (
            <p className="text-base text-muted-foreground">読み込み中…</p>
          ) : null}
        </section>

        <aside className="lg:col-span-2" aria-labelledby="monitor-detail-heading">
          <Card className="rounded-xl shadow-subtle lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle id="monitor-detail-heading" className="text-lg">
                詳細
              </CardTitle>
              <CardDescription className="text-base">
                エラー印を押すと内容が出ます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={resultMeta(selected.result).variant}
                      className="rounded-md"
                    >
                      {resultMeta(selected.result).label}
                    </Badge>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDt(selected.checkedAt)}
                    </span>
                  </div>
                  <p className="font-semibold text-primary-dark">
                    {selected.title}
                  </p>
                  <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {selected.detail}
                  </p>
                  <div className="flex flex-col gap-2">
                    {selected.result === "diff" ? (
                      <Button asChild className="min-h-11">
                        <Link
                          href={
                            selected.draftId
                              ? `/admin/document-changes#draft-${selected.draftId}`
                              : "/admin/document-changes"
                          }
                        >
                          差分を確認する
                        </Link>
                      </Button>
                    ) : null}
                    {selected.documentId ? (
                      <Button asChild variant="outline" className="min-h-11">
                        <Link
                          href={`/admin/rules/documents?doc=${selected.documentId}`}
                        >
                          公開情報監視で開く
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="min-h-11">
                        <Link href="/admin/rules/documents">
                          公開情報監視を開く
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href="/admin/rules/notifications">
                        台帳管理を開く
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-base text-muted-foreground">
                  左の一覧から選んでください。
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
