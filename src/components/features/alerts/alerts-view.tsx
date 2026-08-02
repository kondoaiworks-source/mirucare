"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Loader2,
} from "lucide-react"
import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createDeadlineAction,
  markDeadlineDoneAction,
} from "@/app/actions/deadlines"
import {
  DEADLINE_KIND_OPTIONS,
  DEADLINE_UI,
  toPrivacySubject,
} from "@/lib/deadlines"
import {
  daysUntilDue,
  filterByTab,
  type DeadlineTab,
} from "@/lib/deadline-status"
import type { Deadline, DeadlineKind } from "@/types/database"
import { cn } from "@/lib/utils"

const TABS: { id: DeadlineTab; label: string }[] = [
  { id: "overdue", label: DEADLINE_UI.tabOverdue },
  { id: "within7", label: DEADLINE_UI.tab7 },
  { id: "within30", label: DEADLINE_UI.tab30 },
  { id: "done", label: DEADLINE_UI.tabDone },
]

function StatusLabel({ daysLeft, done }: { daysLeft: number; done: boolean }) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
        <Check className="size-3.5" aria-hidden />
        {DEADLINE_UI.statusDone}
      </span>
    )
  }
  if (daysLeft < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-sm font-medium text-danger"
        role="status"
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {DEADLINE_UI.statusOverdue}
      </span>
    )
  }
  if (daysLeft <= 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1 text-sm font-medium text-warning">
        <Clock className="size-3.5" aria-hidden />
        {DEADLINE_UI.statusWarning}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
      <CalendarClock className="size-3.5" aria-hidden />
      {DEADLINE_UI.statusOk}
    </span>
  )
}

export function AlertsView({
  initialDeadlines,
}: {
  initialDeadlines: Deadline[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<DeadlineTab>("overdue")
  const [deadlines, setDeadlines] = useState(initialDeadlines)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formPending, startForm] = useTransition()

  const filtered = useMemo(
    () => filterByTab(deadlines, tab),
    [deadlines, tab]
  )

  const counts = useMemo(
    () => ({
      overdue: filterByTab(deadlines, "overdue").length,
      within7: filterByTab(deadlines, "within7").length,
      within30: filterByTab(deadlines, "within30").length,
      done: filterByTab(deadlines, "done").length,
    }),
    [deadlines]
  )

  function markDone(id: string) {
    setPendingId(id)
    startForm(async () => {
      const result = await markDeadlineDoneAction(id)
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.error ?? "更新に失敗しました。")
        return
      }
      setDeadlines((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "done" } : d))
      )
      toast.success(DEADLINE_UI.markDoneDone)
      router.refresh()
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const subject = String(fd.get("subject") ?? "")
    const kind = String(fd.get("kind") ?? "同意日") as DeadlineKind
    const dueDate = String(fd.get("dueDate") ?? "")

    startForm(async () => {
      const result = await createDeadlineAction({ subject, kind, dueDate })
      if (!result.ok) {
        toast.error(result.error ?? "追加に失敗しました。")
        return
      }
      if (result.data?.deadline) {
        setDeadlines((prev) => [...prev, result.data!.deadline])
      }
      toast.success("期限を追加しました。")
      setShowForm(false)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">
            {DEADLINE_UI.alertsTitle}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {DEADLINE_UI.alertsDescription}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setShowForm((v) => !v)}
        >
          {DEADLINE_UI.addManual}
        </Button>
      </div>

      {showForm ? (
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">{DEADLINE_UI.addManual}</CardTitle>
            <CardDescription className="text-base">
              対象名は姓＋様までにすると、画面・通知で個人情報を抑えられます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="subject">{DEADLINE_UI.subjectLabel}</Label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  placeholder="山田様 ケアプラン"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kind">{DEADLINE_UI.kindLabel}</Label>
                <select
                  id="kind"
                  name="kind"
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
                  defaultValue="同意日"
                >
                  {DEADLINE_KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">{DEADLINE_UI.dueDateLabel}</Label>
                <Input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" size="lg" disabled={formPending}>
                {formPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {DEADLINE_UI.addManualSubmit}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div
        role="tablist"
        aria-label="期限の区分"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tabular-nums opacity-80">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-base text-muted-foreground">
          {DEADLINE_UI.emptyTab}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((d) => {
            const days = daysUntilDue(d.due_date)
            const done = d.status === "done"
            return (
              <Card key={d.id} className="rounded-lg shadow-subtle">
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusLabel daysLeft={days} done={done} />
                      <span className="text-sm text-muted-foreground">
                        {d.kind}
                      </span>
                      {!done ? (
                        <span className="text-sm font-semibold tabular-nums text-primary-dark">
                          {days < 0
                            ? DEADLINE_UI.daysOverdue(Math.abs(days))
                            : DEADLINE_UI.daysLeft(days)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-base font-semibold text-primary-dark">
                      {toPrivacySubject(d.subject)}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      期限 {d.due_date}
                    </p>
                  </div>
                  {!done ? (
                    <Button
                      type="button"
                      size="lg"
                      className="w-full sm:w-auto"
                      disabled={pendingId === d.id}
                      onClick={() => markDone(d.id)}
                    >
                      {pendingId === d.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-4" aria-hidden />
                      )}
                      {DEADLINE_UI.markDone}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
