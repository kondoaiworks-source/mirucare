"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  addComposeManualRuleAction,
  confirmComposeJobAction,
  discardComposeJobAction,
  getComposeJobAction,
  retireComposeRuleAction,
  setComposeItemIncludedAction,
  type ComposeJobItemView,
  type ComposeJobView,
} from "@/app/actions/compose-rulebook"
import { servicePath } from "@/lib/rule-engine/services"
import { coverageFromLayerCounts } from "@/lib/rule-engine/evidence-coverage"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import { viewRulebookPath } from "@/lib/rule-engine/check-rule-scope"
import type { FindingSeverity } from "@/types/database"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { sourceListPath } from "@/lib/rule-engine/rulebook-source-links"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { EvidenceCoveragePanel } from "@/components/features/admin/rules/evidence-coverage-panel"
import {
  RuleScopeBadge,
  RulebookRuleCard,
} from "@/components/features/admin/rules/rulebook-rule-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { FileWarning, Loader2 } from "lucide-react"

type Props = {
  service: RuleServiceDef
  initial: ComposeJobView
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

  const coverage = useMemo(() => {
    const noteCount = (layer: "national" | "prefecture" | "city") =>
      data.extractionNotes.find((n) => n.layer === layer)?.sourceCount ?? 0
    return coverageFromLayerCounts({
      national: noteCount("national"),
      prefecture: noteCount("prefecture"),
      city: noteCount("city"),
    })
  }, [data.extractionNotes])

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
      const guidanceUpdates = data.items.flatMap((item) => {
        if (!(item.id in editing)) return []
        if (!item.included) return []
        if (item.version?.review_status !== "pending_review") return []
        const versionId = item.version?.id
        if (!versionId) return []
        return [
          {
            versionId,
            guidanceText: editing[item.id] ?? "",
          },
        ]
      })
      const result = await confirmComposeJobAction({
        jobId: data.job.id,
        note,
        guidanceUpdates,
      })
      if (!result.ok) {
        toast.error(result.error ?? "確定できませんでした。")
        return
      }
      if (data.layer === "shared") {
        toast.success("国・県のルールブックを確定しました。続けて自治体の下書きを作れます。")
        router.push(servicePath(service.slug, "compose"))
      } else {
        toast.success("ルールブックを確定しました。チェックに使えます。")
        router.push(viewRulebookPath(service.slug, data.citySlug))
      }
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
          {data.serviceLabel}／{data.cityName}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {RULES_UI.composeDraft}です。承認待ちの本文は必要なら直してください。直した文は、下の「確定する」で一緒に残ります。確定するまでチェックには使いません。
        </p>
      </div>

      <EvidenceCoveragePanel
        coverage={coverage}
        ruleCount={data.includedCount}
        sharedRuleCount={data.sharedCount}
        cityRuleCount={data.cityCount}
        pendingCount={data.pendingCount}
      />

      {data.extractionNotes.length > 0 ? (
        <section
          className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
          aria-labelledby="extraction-notes-heading"
        >
          <h2
            id="extraction-notes-heading"
            className="text-lg font-semibold text-primary-dark"
          >
            公式資料からの抽出
          </h2>
          {data.extractionNotes.some((note) => note.status === "no_text") ? (
            <Alert className="rounded-xl border-accent/40 bg-accent/5">
              <FileWarning className="text-accent" aria-hidden />
              <AlertTitle className="text-base text-primary-dark">
                本文が無い資料があります
              </AlertTitle>
              <AlertDescription className="space-y-3 text-base leading-relaxed">
                <p>
                  AIではなく、人がリンク先を確認します。一覧ページならPDFの直リンクに直してください。
                </p>
                <Button asChild className="min-h-11">
                  <Link
                    href={sourceListPath(service.slug, data.citySlug, {
                      needsText: true,
                    })}
                  >
                    根拠情報でリンクを確認する
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="space-y-2">
            {data.extractionNotes.map((note) => (
              <li key={note.layer} className="text-base leading-relaxed">
                <span className="font-semibold text-primary-dark">
                  {note.label}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  （資料 {note.sourceCount}件／本文 {note.textCount}件）{" "}
                </span>
                <span>{note.message}</span>
                {note.status === "no_text" || note.status === "no_sources" ? (
                  <div className="mt-2">
                    <Button asChild variant="outline" className="min-h-11">
                      <Link
                        href={sourceListPath(service.slug, data.citySlug, {
                          layer: note.layer,
                          needsText: note.status === "no_text",
                        })}
                      >
                        {note.status === "no_sources"
                          ? "根拠情報でURLを追加する"
                          : "根拠情報でリンクを直す"}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
        <h2 className="text-lg font-semibold text-primary-dark">
          ルールの一覧
        </h2>
        {data.items.length > 0 ? (
          <ul className="space-y-3">
            {data.items.map((item) => {
              const pendingReview =
                item.version?.review_status === "pending_review"
              const approved = item.version?.review_status === "approved"
              const guidance =
                editing[item.id] ?? item.version?.guidance_text ?? ""
              const canEditPending = isDraft && item.included && pendingReview
              const guidanceText = item.version?.guidance_text

              return (
                <RulebookRuleCard
                  key={item.id}
                  title={item.rule?.title ?? "（名称なし）"}
                  badges={
                    <>
                      <RuleScopeBadge scopeKind={item.rule?.scope_kind} />
                      {item.included ? null : (
                        <Badge variant="outline" className="rounded-md">
                          対象外
                        </Badge>
                      )}
                      {item.included && pendingReview ? (
                        <Badge className="rounded-md">
                          {RULES_UI.pendingApproval}
                        </Badge>
                      ) : null}
                    </>
                  }
                  actions={
                    isDraft ? (
                      <>
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
                        {item.included && approved ? (
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
                      </>
                    ) : undefined
                  }
                >
                  {canEditPending ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`guidance-${item.id}`}>
                        {RULES_UI.ruleText}
                      </Label>
                      <Textarea
                        id={`guidance-${item.id}`}
                        className="min-h-24 text-base"
                        value={guidance}
                        disabled={pending}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : guidanceText ? (
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                      {guidanceText}
                    </p>
                  ) : null}
                </RulebookRuleCard>
              )
            })}
          </ul>
        ) : (
          <p className="text-base text-muted-foreground">
            この下書きのルールはまだありません。下のフォームから追加するか、ルール案を生成し直してください。
          </p>
        )}
      </section>

      {isDraft ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
          <h2 className="text-lg font-semibold text-primary-dark">
            ルールを追加する
          </h2>
          <form className="space-y-4" onSubmit={onAdd}>
            <div className="space-y-2">
              <Label htmlFor="add-title">{RULES_UI.ruleName}</Label>
              <Input
                id="add-title"
                className="h-11 min-h-11"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-guidance">{RULES_UI.ruleText}</Label>
              <Textarea
                id="add-guidance"
                className="min-h-24 text-base"
                value={addGuidance}
                onChange={(e) => setAddGuidance(e.target.value)}
                placeholder="例：勤務表と提供記録で、実施日時がずれていないかご確認ください。"
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
            このルールを確定する
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            承認待ちの本文を直している場合は、確定するときに一緒に残ります。
          </p>
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
              {RULES_UI.discardAllDraft}
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
