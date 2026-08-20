"use client"

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  getCityRulebookAction,
  type CityRulebookCheckRule,
  type CityRulebookData,
} from "@/app/actions/city-rulebook"
import { listComposeOptionsAction } from "@/app/actions/compose-rulebook"
import {
  addViewRulebookRuleAction,
  deleteViewRulebookRuleAction,
  retireViewRulebookRuleAction,
  updateViewRulebookGuidanceAction,
} from "@/app/actions/view-rulebook"
import { servicePath } from "@/lib/rule-engine/services"
import { VIEW_SHARED_CITY } from "@/lib/rule-engine/check-rule-scope"
import { buildEvidenceCoverage } from "@/lib/rule-engine/evidence-coverage"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { FindingSeverity } from "@/types/database"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSetupPanel } from "@/components/features/admin/rules/city-rulebook-setup-panel"
import { EvidenceCoveragePanel } from "@/components/features/admin/rules/evidence-coverage-panel"
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
import { AlertTriangle, Loader2 } from "lucide-react"

type Props = {
  service: RuleServiceDef
  initialCitySlug?: string | null
}

type MunicipalityOption = {
  id: string
  name: string
  slug: string | null
}

const SCOPE_LABEL: Record<string, string> = {
  shared: "国・県",
  city: "市固有",
}

export function ViewRulebookAdmin({ service, initialCitySlug }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>(
    []
  )
  const [citySlug, setCitySlug] = useState(
    initialCitySlug?.trim() || VIEW_SHARED_CITY
  )
  const [data, setData] = useState<CityRulebookData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState("")
  const [addGuidance, setAddGuidance] = useState("")
  const [addSeverity, setAddSeverity] = useState<FindingSeverity>("mid")

  useEffect(() => {
    void (async () => {
      const result = await listComposeOptionsAction({
        serviceSlug: service.slug,
      })
      if (!result.ok || !result.data) {
        setError(result.error ?? "選択肢を取得できませんでした。")
        return
      }
      setMunicipalities(result.data.municipalities)
      if (!initialCitySlug?.trim() && !citySlug) {
        setCitySlug(VIEW_SHARED_CITY)
      }
    })()
    // 初回の選択肢取得のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.slug])

  const isSharedView = citySlug === VIEW_SHARED_CITY
  const loadCitySlug = isSharedView
    ? municipalities[0]?.slug || ""
    : citySlug

  useEffect(() => {
    if (!loadCitySlug) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const result = await getCityRulebookAction(loadCitySlug)
      if (cancelled) return
      if (!result.ok || !result.data) {
        setError(result.error ?? "ルールブックを開けませんでした。")
        setData(null)
        setLoading(false)
        return
      }
      setData(result.data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadCitySlug])

  function syncCityInUrl(nextSlug: string) {
    setCitySlug(nextSlug)
    const params = new URLSearchParams(searchParams.toString())
    if (nextSlug) params.set("city", nextSlug)
    else params.delete("city")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const visibleRules = useMemo(() => {
    const rules = data?.approvedCheckRules ?? []
    return isSharedView
      ? rules.filter((rule) => rule.scopeKind === "shared")
      : rules.filter((rule) => rule.scopeKind === "city")
  }, [data?.approvedCheckRules, isSharedView])

  const coverage = useMemo(
    () => (data ? buildEvidenceCoverage(data.sources) : null),
    [data]
  )

  async function reload() {
    if (!loadCitySlug) return
    const result = await getCityRulebookAction(loadCitySlug)
    if (result.ok && result.data) setData(result.data)
  }

  function saveGuidance(rule: CityRulebookCheckRule) {
    const text = (editing[rule.ruleId] ?? rule.guidanceText).trim()
    startTransition(async () => {
      const result = await updateViewRulebookGuidanceAction({
        versionId: rule.versionId,
        guidanceText: text,
        severity: rule.severity,
      })
      if (!result.ok) {
        toast.error(result.error ?? "保存できませんでした。")
        return
      }
      toast.success("ルールを更新しました。")
      setEditing((prev) => {
        const next = { ...prev }
        delete next[rule.ruleId]
        return next
      })
      await reload()
    })
  }

  function retire(rule: CityRulebookCheckRule) {
    startTransition(async () => {
      const result = await retireViewRulebookRuleAction({ ruleId: rule.ruleId })
      if (!result.ok) {
        toast.error(result.error ?? "停止できませんでした。")
        return
      }
      toast.success("このルールを停止しました。")
      await reload()
    })
  }

  function remove(rule: CityRulebookCheckRule) {
    startTransition(async () => {
      const result = await deleteViewRulebookRuleAction({
        ruleId: rule.ruleId,
        versionId: rule.versionId,
      })
      if (!result.ok) {
        toast.error(result.error ?? "削除できませんでした。")
        return
      }
      toast.success("ルールを削除しました。")
      setConfirmDeleteId(null)
      await reload()
    })
  }

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const jurisdictionId = isSharedView
      ? null
      : data?.layerJurisdictions.city.id
    if (!isSharedView && !jurisdictionId) return
    startTransition(async () => {
      const result = await addViewRulebookRuleAction({
        title: addTitle,
        guidanceText: addGuidance,
        severity: addSeverity,
        jurisdictionId,
        citySlug: isSharedView ? null : citySlug,
        domainId: null,
        scopeKind: isSharedView ? "shared" : "city",
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
            { label: RULES_UI.viewRulebook },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {RULES_UI.viewRulebook}
        </h1>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="view-city">国・県／自治体</Label>
          <Select
            value={citySlug || undefined}
            onValueChange={syncCityInUrl}
          >
            <SelectTrigger id="view-city" className="h-11 min-h-11">
              <SelectValue placeholder="国・県または自治体を選ぶ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VIEW_SHARED_CITY}>国・県</SelectItem>
              {municipalities.map((m) =>
                m.slug ? (
                  <SelectItem key={m.id} value={m.slug}>
                    {m.name}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          読み込み中です。
        </p>
      ) : null}

      {!loading && data ? (
        <>
          <p className="text-base leading-relaxed text-muted-foreground">
            {isSharedView
              ? `${service.label}／国・県の確定済みルール ${visibleRules.length}件。全市のチェックに足されます。`
              : `${service.label}／${data.city.name}の確定済みルール ${visibleRules.length}件。この市だけのルールです。`}
          </p>

          {coverage ? (
            <EvidenceCoveragePanel
              coverage={coverage}
              ruleCount={visibleRules.length}
              sharedRuleCount={
                isSharedView
                  ? visibleRules.length
                  : data.approvedCheckRules.filter((r) => r.scopeKind === "shared")
                      .length
              }
              cityRuleCount={isSharedView ? 0 : visibleRules.length}
            />
          ) : null}

          {!isSharedView ? (
            <CityRulebookSetupPanel
              readiness={data.setupReadiness}
              citySlug={data.city.slug}
            />
          ) : null}

          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
            <h2 className="text-lg font-semibold text-primary-dark">
              ルールの一覧
            </h2>
            {visibleRules.length > 0 ? (
              <ul className="space-y-3">
                {visibleRules.map((rule) => {
                  const guidance = editing[rule.ruleId] ?? rule.guidanceText
                  return (
                    <li
                      key={rule.ruleId}
                      className="rounded-xl border border-border p-4"
                    >
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-primary-dark">
                          {rule.title}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="rounded-md">
                            {SCOPE_LABEL[rule.scopeKind] ?? "国・県"}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`guidance-${rule.ruleId}`}>
                          {RULES_UI.ruleText}
                        </Label>
                        <Textarea
                          id={`guidance-${rule.ruleId}`}
                          className="min-h-24 text-base"
                          value={guidance}
                          disabled={pending}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [rule.ruleId]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => saveGuidance(rule)}
                        >
                          ルールを保存する
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => retire(rule)}
                        >
                          ルールを停止する
                        </Button>
                        {confirmDeleteId === rule.ruleId ? (
                          <Button
                            type="button"
                            variant="destructive"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => remove(rule)}
                          >
                            削除する（取り消せません）
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => setConfirmDeleteId(rule.ruleId)}
                          >
                            削除する
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-base text-muted-foreground">
                この条件の確定済みルールはまだありません。ルールブック作成から下書きを確定してください。
              </p>
            )}
          </section>

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
        </>
      ) : null}
    </div>
  )
}
