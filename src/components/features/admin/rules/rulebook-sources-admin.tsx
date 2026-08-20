"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getCityRulebookAction, type CityRulebookData } from "@/app/actions/city-rulebook"
import { listComposeOptionsAction } from "@/app/actions/compose-rulebook"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { EvidenceCoveragePanel } from "@/components/features/admin/rules/evidence-coverage-panel"
import { composeRulebookPath } from "@/lib/rule-engine/check-rule-scope"
import { buildEvidenceCoverage } from "@/lib/rule-engine/evidence-coverage"
import { servicePath } from "@/lib/rule-engine/services"
import { SOURCE_URL_FIX_HINT, isReadablePdfSource } from "@/lib/rule-engine/source-urls"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, FileWarning } from "lucide-react"

type Props = {
  service: RuleServiceDef
  initialCitySlug?: string | null
}

type MunicipalityOption = {
  id: string
  name: string
  slug: string | null
}

const LAYERS = ["national", "prefecture", "city"] as const

export function RulebookSourcesAdmin({ service, initialCitySlug }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>(
    []
  )
  const [citySlug, setCitySlug] = useState(initialCitySlug?.trim() || "")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CityRulebookData | null>(null)
  const [onlyNeedsText, setOnlyNeedsText] = useState(
    searchParams.get("needs") === "text"
  )

  const loadCity = useCallback(async (slug: string, silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    const result = await getCityRulebookAction(slug)
    if (!result.ok || !result.data) {
      setError(result.error ?? "根拠情報を開けませんでした。")
      setData(null)
      setLoading(false)
      return
    }
    setData(result.data)
    setLoading(false)
  }, [])

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
      if (!citySlug && result.data.municipalities[0]?.slug) {
        setCitySlug(result.data.municipalities[0].slug)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.slug])

  useEffect(() => {
    if (!citySlug) return
    let cancelled = false
    void (async () => {
      await loadCity(citySlug)
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [citySlug, loadCity])

  useEffect(() => {
    const layer = searchParams.get("layer")
    if (!layer || !LAYERS.includes(layer as (typeof LAYERS)[number])) return
    const el = document.getElementById(`source-layer-${layer}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [searchParams, data, loading])

  function syncCityInUrl(nextSlug: string) {
    setCitySlug(nextSlug)
    const params = new URLSearchParams(searchParams.toString())
    if (nextSlug) params.set("city", nextSlug)
    else params.delete("city")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const missingTextCount = useMemo(() => {
    if (!data) return 0
    return data.sources.filter(
      (s) => isReadablePdfSource(s) && !s.hasText
    ).length
  }, [data])

  const coverage = useMemo(
    () => (data ? buildEvidenceCoverage(data.sources) : null),
    [data]
  )

  const composeHref = composeRulebookPath(service.slug, citySlug || null)

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: RULES_UI.sourceList },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {RULES_UI.sourceList}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          監査に必要な公式PDFと参考リンクを置きます。カバー率で、国・県・市の根拠を登録できているかご確認ください。PDFの直リンクは監視状況に載ります。
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="sources-city">自治体</Label>
          <Select value={citySlug || undefined} onValueChange={syncCityInUrl}>
            <SelectTrigger id="sources-city" className="h-11 min-h-11">
              <SelectValue placeholder="自治体を選ぶ" />
            </SelectTrigger>
            <SelectContent>
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
        {data && missingTextCount > 0 ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={onlyNeedsText}
              onChange={(e) => setOnlyNeedsText(e.target.checked)}
            />
            本文がないPDFだけ見る（{missingTextCount}件）
          </label>
        ) : null}
      </section>

      {coverage ? <EvidenceCoveragePanel coverage={coverage} /> : null}

      {coverage && coverage.recommendedCategories.length > 0 ? (
        <section
          className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:p-5"
          aria-labelledby="recommended-evidence-heading"
        >
          <div>
            <h2
              id="recommended-evidence-heading"
              className="text-lg font-semibold text-primary-dark"
            >
              カバー率を上げるために、次の情報追加をご確認ください
            </h2>
            <p className="mt-1 text-base leading-relaxed text-muted-foreground">
              {RULES_UI.evidenceCategory}ごとに、監査でよく使う根拠の置き場です。未登録のものは下の国・県・市から追加できます。
            </p>
          </div>
          <ul className="space-y-2">
            {coverage.recommendedCategories.map((cat) => (
              <li
                key={cat.category}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="text-base font-semibold text-primary-dark">
                  {cat.label}
                </span>
                <Button asChild variant="outline" className="min-h-11">
                  <a href={`#source-layer-national`}>資料を追加する</a>
                </Button>
              </li>
            ))}
          </ul>
          <Button asChild className="min-h-11">
            <a href={composeHref}>{RULES_UI.addToRulebook}</a>
          </Button>
        </section>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription className="text-base">{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-base text-muted-foreground">読み込み中です。</p>
      ) : data ? (
        <div className="space-y-6">
          {missingTextCount > 0 ? (
            <Alert className="rounded-xl border-accent/40 bg-accent/5">
              <FileWarning className="text-accent" aria-hidden />
              <AlertTitle className="text-base text-primary-dark">
                本文が無い読むPDFが {missingTextCount}件あります
              </AlertTitle>
              <AlertDescription className="text-base leading-relaxed">
                {SOURCE_URL_FIX_HINT}{" "}
                直したあと、ルールブック作成から下書きを作り直してください。
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-base leading-relaxed text-muted-foreground">
              この自治体の読むPDFは、本文がある状態です。参考リンクはリンク集にあります。
            </p>
          )}

          {LAYERS.map((layer, index) => {
            const layerLabel =
              layer === "national"
                ? "国"
                : layer === "prefecture"
                  ? data.city.prefectureName
                  : data.city.name
            const layerSources = data.sources.filter((s) => s.layer === layer)
            const pdfSources = layerSources.filter((s) =>
              isReadablePdfSource(s)
            )
            const linkCount = layerSources.length - pdfSources.length
            const visible = onlyNeedsText
              ? pdfSources.filter((s) => !s.hasText)
              : layerSources
            const textCount = pdfSources.filter((s) => s.hasText).length
            return (
              <section
                key={layer}
                className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
              >
                <p className="text-sm text-muted-foreground tabular-nums">
                  読む資料 {pdfSources.length}件／本文 {textCount}件
                  {linkCount > 0 ? `／リンク集 ${linkCount}件` : ""}
                </p>
                {onlyNeedsText && visible.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    {layerLabel}に、本文が無い読むPDFはありません。
                  </p>
                ) : (
                  <CityRulebookSourcesPanel
                    layer={layer}
                    layerLabel={layerLabel}
                    jurisdictionId={data.layerJurisdictions[layer]?.id ?? null}
                    sources={visible}
                    showMonitoringAlert={index === 0 && !onlyNeedsText}
                    composeHref={composeHref}
                    onChanged={() => void loadCity(citySlug, true)}
                  />
                )}
              </section>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
