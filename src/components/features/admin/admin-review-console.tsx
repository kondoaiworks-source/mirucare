"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  FileText,
  MapPin,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/features/empty-state"
import { RiskBadge, type RiskLevel } from "@/components/features/risk-badge"
import {
  reviewFindingAction,
  updateFeedbackNoteAction,
} from "@/app/actions/admin-review"
import {
  ADMIN_REVIEW_UI,
  formatDurationMs,
  severityLabelJa,
  type FeedbackInboxItem,
  type ReviewMetrics,
  type ReviewQueueItem,
} from "@/lib/admin-review"
import type { FindingSeverity } from "@/types/database"
import { cn } from "@/lib/utils"

function toRiskLevel(severity: FindingSeverity): RiskLevel {
  if (severity === "high") return "high"
  if (severity === "low") return "low"
  return "medium"
}

type AdminReviewConsoleProps = {
  initialQueue: ReviewQueueItem[]
  initialMetrics: ReviewMetrics
  initialFeedback: FeedbackInboxItem[]
}

export function AdminReviewConsole({
  initialQueue,
  initialMetrics,
  initialFeedback,
}: AdminReviewConsoleProps) {
  const [queue, setQueue] = useState(initialQueue)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [index, setIndex] = useState(0)
  const [pending, startTransition] = useTransition()
  const startedAtRef = useRef(Date.now())
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const basisRef = useRef<HTMLTextAreaElement>(null)
  const suggestionRef = useRef<HTMLTextAreaElement>(null)

  const current = queue[index] ?? null

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [current?.id])

  const elapsedMs = () => Date.now() - startedAtRef.current

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(queue.length - 1, 0)))
  }, [queue.length])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  const applyDecision = useCallback(
    (decision: "approve" | "edit" | "reject") => {
      if (!current || pending) return

      const durationMs = elapsedMs()
      const payload = {
        findingId: current.id,
        decision,
        durationMs,
        title: titleRef.current?.value,
        description: descRef.current?.value,
        basis: basisRef.current?.value,
        suggestion: suggestionRef.current?.value,
      }

      startTransition(async () => {
        const result = await reviewFindingAction(payload)
        if (!result.ok) {
          toast.error(result.error ?? "処理に失敗しました")
          return
        }

        const removedId = current.id
        setQueue((prev) => {
          const next = prev.filter((f) => f.id !== removedId)
          setIndex((i) => Math.min(i, Math.max(next.length - 1, 0)))
          return next
        })
        setMetrics((m) => ({
          pendingCount: result.data?.remaining ?? Math.max(m.pendingCount - 1, 0),
          reviewedToday: m.reviewedToday + 1,
          avgDurationMs:
            m.avgDurationMs == null
              ? durationMs
              : Math.round(
                  (m.avgDurationMs * m.sampleCount + durationMs) /
                    (m.sampleCount + 1)
                ),
          sampleCount: m.sampleCount + 1,
        }))

        const label =
          decision === "reject"
            ? "却下しました"
            : decision === "edit"
              ? "修正して承認しました"
              : "承認しました"
        toast.success(`${label}（${formatDurationMs(durationMs)}）`)
      })
    },
    [current, pending]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const inField =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable === true

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        applyDecision("edit")
        return
      }

      if (inField) return

      const key = e.key.toLowerCase()
      if (key === "j") {
        e.preventDefault()
        goNext()
      } else if (key === "k") {
        e.preventDefault()
        goPrev()
      } else if (key === "a") {
        e.preventDefault()
        applyDecision("approve")
      } else if (key === "r") {
        e.preventDefault()
        applyDecision("reject")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [applyDecision, goNext, goPrev])

  const saveNote = (id: string, note: string) => {
    startTransition(async () => {
      const result = await updateFeedbackNoteAction({ feedbackId: id, note })
      if (!result.ok) {
        toast.error(result.error ?? "メモの保存に失敗しました")
        return
      }
      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, operator_note: note } : f))
      )
      toast.success("対応メモを保存しました")
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          {ADMIN_REVIEW_UI.title}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {ADMIN_REVIEW_UI.description}
        </p>
        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
          {ADMIN_REVIEW_UI.shortcuts}
        </p>
      </div>

      {/* メトリクス */}
      <section aria-labelledby="review-metrics">
        <h2 id="review-metrics" className="sr-only">
          {ADMIN_REVIEW_UI.metricsTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={Clock}
            label={ADMIN_REVIEW_UI.avgLabel}
            value={formatDurationMs(metrics.avgDurationMs)}
            hint={
              metrics.sampleCount > 0
                ? `直近${metrics.sampleCount}件の平均`
                : ADMIN_REVIEW_UI.metricsHint
            }
          />
          <MetricCard
            icon={AlertTriangle}
            label={ADMIN_REVIEW_UI.pendingLabel}
            value={`${metrics.pendingCount}`}
            suffix="件"
            hint="古い順に処理してください"
          />
          <MetricCard
            icon={Check}
            label={ADMIN_REVIEW_UI.reviewedTodayLabel}
            value={`${metrics.reviewedToday}`}
            suffix="件"
            hint="本日の処理件数"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
        {/* キュー一覧 */}
        <section aria-labelledby="review-queue" className="space-y-3">
          <h2
            id="review-queue"
            className="text-lg font-bold text-primary-dark"
          >
            {ADMIN_REVIEW_UI.queueTitle}
            <span className="ml-2 text-base font-normal tabular-nums text-muted-foreground">
              {queue.length}
            </span>
          </h2>
          {queue.length === 0 ? (
            <EmptyState
              title={ADMIN_REVIEW_UI.queueEmpty}
              description={ADMIN_REVIEW_UI.queueEmptyHint}
              className="py-10"
            />
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-2">
              {queue.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === index
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                    aria-current={i === index ? "true" : undefined}
                  >
                    <span className="line-clamp-2 text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.organization_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 詳細レビュー */}
        <section aria-labelledby="review-detail" className="min-w-0">
          <h2 id="review-detail" className="sr-only">
            指摘のレビュー
          </h2>
          {!current ? (
            <Card className="rounded-lg shadow-subtle">
              <CardContent className="py-12 text-center text-muted-foreground">
                {ADMIN_REVIEW_UI.queueEmpty}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-lg shadow-subtle">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={toRiskLevel(current.severity)} />
                  <Badge variant="secondary" className="tabular-nums">
                    {severityLabelJa(current.severity)}
                  </Badge>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {index + 1} / {queue.length}
                  </span>
                </div>
                <CardTitle className="text-xl leading-snug">
                  {current.title}
                </CardTitle>
                <CardDescription className="flex flex-col gap-2 text-base">
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="text-muted-foreground">
                        {ADMIN_REVIEW_UI.orgLabel}：
                      </span>
                      {current.organization_name}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="text-muted-foreground">
                        {ADMIN_REVIEW_UI.docTypeLabel}：
                      </span>
                      {current.doc_type}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="text-muted-foreground">
                        {ADMIN_REVIEW_UI.municipalityLabel}：
                      </span>
                      {current.municipality ?? "未設定"}
                    </span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-primary-dark">
                    {ADMIN_REVIEW_UI.originalTitle}
                  </h3>
                  <div className="space-y-2 rounded-lg border border-border bg-surface p-4 text-base leading-relaxed">
                    <p>{current.description}</p>
                    {current.basis ? (
                      <p className="text-sm text-muted-foreground">
                        根拠：{current.basis}
                      </p>
                    ) : null}
                    {current.suggestion ? (
                      <p className="text-sm text-muted-foreground">
                        修正参考：{current.suggestion}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {ADMIN_REVIEW_UI.editHint}
                </p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="review-title">タイトル</Label>
                    <Input
                      id="review-title"
                      ref={titleRef}
                      key={`title-${current.id}`}
                      defaultValue={current.title}
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-desc">説明</Label>
                    <textarea
                      id="review-desc"
                      ref={descRef}
                      key={`desc-${current.id}`}
                      defaultValue={current.description}
                      rows={4}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-basis">根拠</Label>
                    <textarea
                      id="review-basis"
                      ref={basisRef}
                      key={`basis-${current.id}`}
                      defaultValue={current.basis ?? ""}
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-suggestion">修正参考案</Label>
                    <textarea
                      id="review-suggestion"
                      ref={suggestionRef}
                      key={`sug-${current.id}`}
                      defaultValue={current.suggestion ?? ""}
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    size="lg"
                    disabled={pending}
                    onClick={() => applyDecision("approve")}
                    className="min-w-[10rem]"
                  >
                    <Check className="size-5" aria-hidden />
                    {ADMIN_REVIEW_UI.approve}
                    <kbd className="ml-1 rounded border border-primary-foreground/30 px-1.5 text-xs">
                      A
                    </kbd>
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled={pending}
                    onClick={() => applyDecision("edit")}
                  >
                    {ADMIN_REVIEW_UI.approveEdit}
                    <kbd className="ml-1 rounded border border-border px-1.5 text-xs">
                      ⌘↵
                    </kbd>
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => applyDecision("reject")}
                  >
                    <X className="size-5" aria-hidden />
                    {ADMIN_REVIEW_UI.reject}
                    <kbd className="ml-1 rounded border border-danger-foreground/30 px-1.5 text-xs">
                      R
                    </kbd>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* フィードバック */}
      <section aria-labelledby="feedback-inbox" className="space-y-4">
        <div>
          <h2
            id="feedback-inbox"
            className="text-lg font-bold text-primary-dark"
          >
            {ADMIN_REVIEW_UI.feedbackTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            ナレッジベース改善のToDoとして対応メモを残せます。
          </p>
        </div>
        {feedback.length === 0 ? (
          <EmptyState
            title={ADMIN_REVIEW_UI.feedbackEmpty}
            description="事業所が「これは違うと思う」を押すとここに集まります。"
            className="py-10"
          />
        ) : (
          <ul className="space-y-4">
            {feedback.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                disabled={pending}
                onSave={saveNote}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
}: {
  icon: typeof Clock
  label: string
  value: string
  suffix?: string
  hint: string
}) {
  return (
    <Card className="rounded-lg shadow-subtle">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums text-primary-dark">
          {value}
          {suffix ? (
            <span className="ml-1 text-base font-semibold">{suffix}</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      </CardContent>
    </Card>
  )
}

function FeedbackCard({
  item,
  disabled,
  onSave,
}: {
  item: FeedbackInboxItem
  disabled: boolean
  onSave: (id: string, note: string) => void
}) {
  const [note, setNote] = useState(item.operator_note ?? "")

  return (
    <Card className="rounded-lg shadow-subtle">
      <CardHeader className="pb-3">
        <CardTitle className="text-base leading-snug">
          {item.finding_title}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {item.organization_name} ／ {item.doc_type}
          {item.reason ? ` ／ ${item.reason}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={`note-${item.id}`}>
            {ADMIN_REVIEW_UI.feedbackNoteLabel}
          </Label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="例：同意日の判定プロンプトを見直す"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onSave(item.id, note)}
        >
          {ADMIN_REVIEW_UI.feedbackNoteSave}
        </Button>
      </CardContent>
    </Card>
  )
}
