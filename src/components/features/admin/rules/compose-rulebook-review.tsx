"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  addComposeManualRuleAction,
  confirmComposeJobAction,
  discardComposeJobAction,
  getComposeJobAction,
  retireComposeRuleAction,
  setComposeItemIncludedAction,
  updateComposeItemGuidanceAction,
  type ComposeJobItemView,
  type ComposeJobView,
} from "@/app/actions/compose-rulebook"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { FindingSeverity } from "@/types/database"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

type Props = {
  service: RuleServiceDef
  initial: ComposeJobView
}

const ORIGIN_LABEL: Record<ComposeJobItemView["origin"], string> = {
  existing: "既存",
  template: "自動",
  manual: "追加",
  city_pdf: "市資料",
}

const SCOPE_LABEL: Record<string, string> = {
  shared: "国・県",
  city: "市固有",
}

export function ComposeRulebookReview({ service, initial }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState(
    "内容を確認し、このルールブックを確定します。"
  )
  const [addTitle, setAddTitle] = useState("")
  const [addGuidance, setAddGuidance] = useState("")
  const [addSeverity, setAddSeverity] = useState<FindingSeverity>("mid")
  const [editing, setEditing] = useState<Record<string, string>>({})

  const grouped = useMemo(() => {
    const map = new Map<string, ComposeJobItemView[]>()
    for (const item of data.items) {
      const key = item.domainTitle?.trim() || "未分類"
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [data.items])

  const isDraft = data.job.status === "draft"

  function refreshFrom(next: ComposeJobView) {
    setData(next)
  }

  async function reload() {
    const result = await getComposeJobAction({ jobId: data.job.id })
    if (result.ok && result.data) refreshFrom(result.data)
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmComposeJobAction({
        jobId: data.job.id,
        note,
      })
      if (!result.ok) {
        toast.error(result.error ?? "確定できませんでした。")
        return
      }
      toast.success("ルールブックを確定しました。チェックに使えます。")
      router.push(
        data.citySlug
          ? `${servicePath(service.slug, "book")}?city=${encodeURIComponent(data.citySlug)}`
          : servicePath(service.slug, "book")
      )
    })
  }

  function discard() {
    startTransition(async () => {
      const result = await discardComposeJobAction({ jobId: data.job.id })
      if (!result.ok) {
        toast.error(result.error ?? "破棄できませんでした。")
        return
      }
      toast.success("下書きを破棄しました。")
      router.push(servicePath(service.slug, "compose"))
    })
  }

  function exclude(item: ComposeJobItemView) {
    startTransition(async () => {
      const result = await setComposeItemIncludedAction({
        itemId: item.id,
        included: false,
      })
      if (!result.ok) {
        toast.error(result.error ?? "外せませんでした。")
        return
      }
      toast.success("下書きから外しました。")
      await reload()
    })
  }

  function restore(item: ComposeJobItemView) {
    startTransition(async () => {
      const result = await setComposeItemIncludedAction({
        itemId: item.id,
        included: true,
      })
      if (!result.ok) {
        toast.error(result.error ?? "戻せませんでした。")
        return
      }
      await reload()
    })
  }

  function retire(item: ComposeJobItemView) {
    startTransition(async () => {
      const result = await retireComposeRuleAction({
        ruleId: item.rule_id,
        itemId: item.id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "停止できませんでした。")
        return
      }
      toast.success("このルールを停止しました。")
      await reload()
    })
  }

  function saveGuidance(item: ComposeJobItemView) {
    const versionId = item.version?.id
    if (!versionId) return
    const text = (editing[item.id] ?? item.version?.guidance_text ?? "").trim()
    startTransition(async () => {
      const result = await updateComposeItemGuidanceAction({
        versionId,
        guidanceText: text,
        severity: (item.version?.severity as FindingSeverity) ?? "mid",
      })
      if (!result.ok) {
        toast.error(result.error ?? "保存できませんでした。")
        return
      }
      toast.success("案内文を更新しました。")
      setEditing((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
      await reload()
    })
  }

  function onAdd(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await addComposeManualRuleAction({
        jobId: data.job.id,
        title: addTitle,
        guidanceText: addGuidance,
        severity: addSeverity,
        domainId: data.job.domain_id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "追加できませんでした。")
        return
      }
      toast.success("ルールを追加しました。")
      setAddTitle("")
      setAddGuidance("")
      await reload()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            {
              label: RULES_UI.composeRulebook,
              href: servicePath(service.slug, "compose"),
            },
            { label: RULES_UI.composeDraft },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {data.serviceLabel}／{data.domainLabel}／{data.cityName}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          下書き {data.includedCount}件（国・県 {data.sharedCount}件／市固有 {data.cityCount}件。承認待ち {data.pendingCount}件）。確定するまでチェックには使いません。
        </p>
      </div>

      {grouped.map(([domainTitle, items]) => (
        <section
          key={domainTitle}
          className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        >
          <h2 className="text-lg font-semibold text-primary-dark">
            {domainTitle}
          </h2>
          <ul className="space-y-3">
            {items.map((item) => {
              const pendingReview =
                item.version?.review_status === "pending_review"
              const guidance =
                editing[item.id] ?? item.version?.guidance_text ?? ""
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-primary-dark">
                        {item.rule?.title ?? "（名称なし）"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="rounded-md">
                          {ORIGIN_LABEL[item.origin]}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                          {SCOPE_LABEL[item.rule?.scope_kind ?? "shared"] ??
                            "国・県"}
                        </Badge>
                        {item.included ? null : (
                          <Badge variant="outline" className="rounded-md">
                            対象外
                          </Badge>
                        )}
                        {pendingReview ? (
                          <Badge className="rounded-md">承認待ち</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md">
                            登録済み
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.included && pendingReview ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`guidance-${item.id}`}>案内文</Label>
                      <Textarea
                        id={`guidance-${item.id}`}
                        className="min-h-24 text-base"
                        value={guidance}
                        disabled={!isDraft || pending}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : item.included && item.version?.guidance_text ? (
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                      {item.version.guidance_text}
                    </p>
                  ) : null}

                  {isDraft ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.included && pendingReview ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => saveGuidance(item)}
                        >
                          案内文を保存する
                        </Button>
                      ) : null}
                      {item.included ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => exclude(item)}
                        >
                          下書きから外す
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => restore(item)}
                        >
                          下書きに戻す
                        </Button>
                      )}
                      {item.included &&
                      item.version?.review_status === "approved" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => retire(item)}
                        >
                          ルールを停止する
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {isDraft ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
          <h2 className="text-lg font-semibold text-primary-dark">
            ルールを追加する
          </h2>
          <form className="space-y-4" onSubmit={onAdd}>
            <div className="space-y-2">
              <Label htmlFor="add-title">ルール名</Label>
              <Input
                id="add-title"
                className="h-11 min-h-11"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-guidance">案内文</Label>
              <Textarea
                id="add-guidance"
                className="min-h-24 text-base"
                value={addGuidance}
                onChange={(e) => setAddGuidance(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-severity">優先度</Label>
              <Select
                value={addSeverity}
                onValueChange={(v) => setAddSeverity(v as FindingSeverity)}
              >
                <SelectTrigger id="add-severity" className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">緊急</SelectItem>
                  <SelectItem value="mid">要改善</SelectItem>
                  <SelectItem value="low">推奨</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="min-h-11" disabled={pending}>
              追加する
            </Button>
          </form>
        </section>
      ) : null}

      {isDraft ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
          <h2 className="text-lg font-semibold text-primary-dark">
            確定する
          </h2>
          <div className="space-y-2">
            <Label htmlFor="confirm-note">確認記録</Label>
            <Textarea
              id="confirm-note"
              className="min-h-20 text-base"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={pending || data.includedCount === 0}
              onClick={confirm}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {RULES_UI.confirmRulebook}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={discard}
            >
              下書きを破棄する
            </Button>
          </div>
        </section>
      ) : (
        <p className="text-base text-muted-foreground">
          この下書きは{data.job.status === "confirmed" ? "確定済み" : "破棄済み"}です。
        </p>
      )}
    </div>
  )
}
