"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Upload, Check, Clock } from "lucide-react"
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
  const typeMeta = DOC_TYPE_OPTIONS.find((o) => o.value === doc.doc_type)
  const Icon = typeMeta?.icon
  const href =
    doc.status === "uploaded" ? "/check/upload" : `/check/${doc.id}`

  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="rounded-lg shadow-subtle transition-colors hover:bg-muted/40">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {Icon ? (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
              ) : null}
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {doc.original_name}
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {doc.doc_type}
                  {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : null}
                </CardDescription>
              </div>
            </div>
            <StatusBadge doc={doc} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {new Date(doc.created_at).toLocaleString("ja-JP", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

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

  const todayStart = startOfToday()
  const today = sortDocumentListItems(
    documents.filter((d) => new Date(d.created_at) >= todayStart)
  )
  const past = sortDocumentListItems(
    documents.filter((d) => new Date(d.created_at) < todayStart)
  )

  return (
    <div className="space-y-8">
      <DocumentsRefreshPoller />
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-primary-dark">今日の分</h2>
          <p className="text-sm tabular-nums text-muted-foreground">
            {today.length}件
          </p>
        </div>
        {today.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-base text-muted-foreground">
            今日のアップロードはまだありません。
          </p>
        ) : (
          <div className="grid gap-3">
            {today.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-primary-dark">過去の分</h2>
          <p className="text-sm tabular-nums text-muted-foreground">
            {past.length}件
          </p>
        </div>
        {past.length === 0 ? (
          <p className={cn("text-base text-muted-foreground")}>
            過去の書類はまだありません。
          </p>
        ) : (
          <div className="grid gap-3">
            {past.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
