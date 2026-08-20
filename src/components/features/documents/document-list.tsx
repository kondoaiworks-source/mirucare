"use client"

import { useEffect, useMemo, useState, useTransition, type MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  Check,
  Clock,
} from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/features/empty-state"
import { cancelUploadedDocumentAction } from "@/app/actions/documents"
import {
  formatFileSize,
  DOC_TYPE_OPTIONS,
  documentListBadgeLabel,
  documentListBucket,
  sortDocumentListItems,
  type DocumentListItem,
} from "@/lib/documents"
import { cn } from "@/lib/utils"

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function StatusBadge({ doc }: { doc: DocumentListItem }) {
  const label = documentListBadgeLabel(doc)
  const bucket = documentListBucket(doc)

  if (doc.status === "checking") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 rounded-lg border border-primary/20 bg-primary/10 text-primary"
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {label}
      </Badge>
    )
  }

  if (bucket === "done") {
    return (
      <Badge className="gap-1 rounded-lg border-transparent bg-primary text-primary-foreground hover:bg-primary">
        <Check className="size-3.5" aria-hidden />
        {label}
      </Badge>
    )
  }

  if (bucket === "later") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 rounded-lg border border-warning/30 bg-warning/10 text-warning"
      >
        <Clock className="size-3.5" aria-hidden />
        {label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className="rounded-lg border border-warning/30 bg-warning/10 text-warning"
    >
      {label}
    </Badge>
  )
}

function DocumentCard({ doc }: { doc: DocumentListItem }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const typeMeta = DOC_TYPE_OPTIONS.find((o) => o.value === doc.doc_type)
  const Icon = typeMeta?.icon
  const isUploaded = doc.status === "uploaded"
  const href = isUploaded
    ? `/check/upload?documentId=${encodeURIComponent(doc.id)}`
    : `/check/${doc.id}`

  function cancelUpload(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (
      !window.confirm(
        "このアップロードを取り消しますか？一覧から消え、種類の選択前の状態に戻ります。"
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await cancelUploadedDocumentAction(doc.id)
      if (!result.ok) {
        toast.error(result.error ?? "取り消しに失敗しました")
        return
      }
      toast.success("アップロードを取り消しました")
      router.refresh()
    })
  }

  const meta = (
    <>
      <CardHeader className="min-w-0 space-y-2 pb-2">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <CardTitle className="min-w-0 flex-1 break-words text-base leading-snug [overflow-wrap:anywhere]">
                {doc.original_name}
              </CardTitle>
              <span className="shrink-0">
                <StatusBadge doc={doc} />
              </span>
            </div>
            <CardDescription className="break-words text-sm [overflow-wrap:anywhere]">
              {isUploaded ? "種類未設定" : doc.doc_type}
              {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : null}
              {doc.check_as_of &&
              (doc.status === "reviewed" || doc.status === "done")
                ? ` · 基準日 ${doc.check_as_of}`
                : null}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 pb-3">
        <p className="text-sm text-muted-foreground">
          {new Date(doc.created_at).toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </CardContent>
    </>
  )

  if (!isUploaded) {
    return (
      <Card className="min-w-0 overflow-hidden rounded-lg shadow-subtle transition-colors hover:bg-muted/40">
        <Link
          href={href}
          className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {meta}
        </Link>
      </Card>
    )
  }

  return (
    <Card className="min-w-0 overflow-hidden rounded-lg shadow-subtle">
      <div className="min-w-0">{meta}</div>
      <CardContent className="min-w-0 space-y-3 border-t border-border pt-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          チェックを続けるか、下のボタンで取り消しできます。
        </p>
        <Button asChild size="lg" className="relative z-10 min-h-11 w-full max-w-full">
          <Link href={href}>続けてチェックする</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="relative z-10 min-h-11 w-full max-w-full"
          disabled={pending}
          onClick={cancelUpload}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              取り消し中…
            </>
          ) : (
            "このアップロードを取り消す"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

const PAST_PAGE_SIZE = 15

function DocumentsRefreshPoller() {
  const router = useRouter()
  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh()
    }, 4000)
    return () => window.clearInterval(id)
  }, [router])
  return null
}

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  const [pastPage, setPastPage] = useState(1)

  const { today, past } = useMemo(() => {
    const todayStart = startOfToday()
    return {
      today: sortDocumentListItems(
        documents.filter((d) => new Date(d.created_at) >= todayStart)
      ),
      past: sortDocumentListItems(
        documents.filter((d) => new Date(d.created_at) < todayStart)
      ),
    }
  }, [documents])

  const totalPages = Math.max(1, Math.ceil(past.length / PAST_PAGE_SIZE))

  // 件数変動でページが範囲外になったら補正する
  useEffect(() => {
    setPastPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={Upload}
        title="まだ書類がありません。最初の1枚をチェックしてみましょう"
        description="介護ソフトのCSV/PDFや、紙書類の写真をアップロードすると、指摘されやすい不備の可能性をご確認いただけます。"
        action={
          <Button asChild size="lg">
            <Link href="/check/upload">最初の1枚をアップロードする</Link>
          </Button>
        }
      />
    )
  }

  const pastStart = (pastPage - 1) * PAST_PAGE_SIZE
  const pastPageItems = past.slice(pastStart, pastStart + PAST_PAGE_SIZE)
  const pastRangeStart = past.length === 0 ? 0 : pastStart + 1
  const pastRangeEnd = Math.min(pastStart + PAST_PAGE_SIZE, past.length)

  return (
    <div className="min-w-0 space-y-8">
      <DocumentsRefreshPoller />
      <section className="min-w-0 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="min-w-0 text-lg font-bold text-primary-dark">
            今日の分
          </h2>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {today.length}件
          </p>
        </div>
        {today.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-base text-muted-foreground">
            今日のアップロードはまだありません。
          </p>
        ) : (
          <div className="grid min-w-0 gap-3">
            {today.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="min-w-0 text-lg font-bold text-primary-dark">
            過去の分
          </h2>
          <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {past.length}件
          </p>
        </div>
        {past.length === 0 ? (
          <p className={cn("text-base text-muted-foreground")}>
            過去の書類はまだありません。
          </p>
        ) : (
          <>
            <div className="grid min-w-0 gap-3">
              {pastPageItems.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>

            {totalPages > 1 ? (
              <nav
                className="flex items-center justify-between gap-3 pt-1"
                aria-label="過去の分のページ送り"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-h-11"
                  disabled={pastPage <= 1}
                  onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  前へ
                </Button>
                <p
                  className="text-sm tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {pastRangeStart}–{pastRangeEnd} / {past.length}件（{pastPage}/
                  {totalPages}ページ）
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-h-11"
                  disabled={pastPage >= totalPages}
                  onClick={() =>
                    setPastPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  次へ
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
