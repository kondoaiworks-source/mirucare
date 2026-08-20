"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  getCityRulebookAction,
  type CityRulebookData,
} from "@/app/actions/city-rulebook"
import {
  listComposeOptionsAction,
  startComposeRulebookAction,
} from "@/app/actions/compose-rulebook"
import { encodeDomainSelection } from "@/lib/rule-engine/domains"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { RuleDomain } from "@/types/database"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
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
import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  service: RuleServiceDef
  initialCitySlug?: string | null
  reason?: string | null
}

type MunicipalityOption = {
  id: string
  name: string
  slug: string | null
}

export function ComposeRulebookForm({
  service,
  initialCitySlug,
  reason,
}: Props) {
  const router = useRouter()
  const [domains, setDomains] = useState<RuleDomain[]>([])
  const [municipalities, setMunicipalities] = useState<MunicipalityOption[]>(
    []
  )
  const [error, setError] = useState<string | null>(null)
  const [jurisdictionId, setJurisdictionId] = useState("")
  const [pending, startTransition] = useTransition()
  const [pendingLayer, setPendingLayer] = useState<"shared" | "city" | null>(
    null
  )
  const [book, setBook] = useState<CityRulebookData | null>(null)
  const [bookLoading, setBookLoading] = useState(false)

  const previewSlug = useMemo(() => {
    const selected = municipalities.find((m) => m.id === jurisdictionId)
    return selected?.slug || municipalities[0]?.slug || ""
  }, [jurisdictionId, municipalities])

  useEffect(() => {
    void (async () => {
      const result = await listComposeOptionsAction({
        serviceSlug: service.slug,
      })
      if (!result.ok || !result.data) {
        setError(result.error ?? "選択肢を取得できませんでした。")
        return
      }
      setDomains(result.data.domains)
      setMunicipalities(result.data.municipalities)
      const fromQuery = initialCitySlug?.trim()
      const matched = fromQuery
        ? result.data.municipalities.find((m) => m.slug === fromQuery)
        : undefined
      if (matched) {
        setJurisdictionId(matched.id)
      }
    })()
  }, [service.slug, initialCitySlug])

  useEffect(() => {
    if (reason !== "source-changed") return
    const id = initialCitySlug ? "compose-city" : "compose-shared"
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [reason, initialCitySlug, book])

  useEffect(() => {
    if (!previewSlug) return
    let cancelled = false
    void (async () => {
      setBookLoading(true)
      const result = await getCityRulebookAction(previewSlug)
      if (cancelled) return
      if (result.ok && result.data) setBook(result.data)
      else setBook(null)
      setBookLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [previewSlug])

  const activeDomainIds = domains.map((d) => d.id)
  const domainValue = encodeDomainSelection(activeDomainIds, activeDomainIds)

  function onGenerate(layer: "shared" | "city") {
    setPendingLayer(layer)
    startTransition(async () => {
      const result = await startComposeRulebookAction({
        serviceSlug: service.slug,
        domainValue,
        jurisdictionId,
        layer,
      })
      if (!result.ok || !result.data) {
        setPendingLayer(null)
        toast.error(result.error ?? "下書きを作れませんでした。")
        return
      }
      if (result.data.sourceNote) {
        toast.message(result.data.sourceNote)
      }
      router.push(servicePath(service.slug, "compose", result.data.jobId))
    })
  }

  const sharedHighlight = reason === "source-changed" && !initialCitySlug
  const cityHighlight = reason === "source-changed" && Boolean(initialCitySlug)

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: RULES_UI.composeRulebook },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {RULES_UI.composeRulebook}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          ルールの根拠にするPDFのURLを登録して、「ルール案を生成」をクリックしてください。表示されるルールを保存すると、ルールブックが完成します。確定するまでチェックには使いません。
        </p>
      </div>

      {reason === "source-changed" ? (
        <Alert className="rounded-xl border-accent/40 bg-accent/5">
          <AlertTriangle className="text-accent" />
          <AlertTitle className="text-base text-primary-dark">
            公式資料が変わった可能性があります
          </AlertTitle>
          <AlertDescription className="text-base leading-relaxed">
            {initialCitySlug
              ? "原文を確認したうえで、上記自治体のルール案を生成し直してください。"
              : "原文を確認したうえで、共通ルール案を生成し直してください。市の資料なら、2で自治体を選んでください。"}
            確定するまでチェックには使いません。
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section
        id="compose-shared"
        className={cn(
          "space-y-4 rounded-xl border bg-card p-4 shadow-subtle sm:p-5",
          sharedHighlight ? "border-accent/50" : "border-border"
        )}
        aria-labelledby="compose-shared-heading"
      >
        <h2
          id="compose-shared-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          1. 国・県
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          国・県の公式PDFから、全市で使うルール案を作ります。読むPDFが無ければここで置きます。参考リンクはリンク集です。ルール案を生成したあと、直して確定してください。
        </p>
        {bookLoading && !book ? (
          <p className="text-base text-muted-foreground">読み込み中です。</p>
        ) : book ? (
          <div className="space-y-6">
            <CityRulebookSourcesPanel
              layer="national"
              layerLabel="国"
              jurisdictionId={book.layerJurisdictions.national?.id ?? null}
              sources={book.sources.filter((s) => s.layer === "national")}
              showMonitoringAlert
              onChanged={() => {
                if (previewSlug) {
                  void getCityRulebookAction(previewSlug).then((r) => {
                    if (r.ok && r.data) setBook(r.data)
                  })
                }
              }}
            />
            <CityRulebookSourcesPanel
              layer="prefecture"
              layerLabel={book.city.prefectureName}
              jurisdictionId={book.layerJurisdictions.prefecture?.id ?? null}
              sources={book.sources.filter((s) => s.layer === "prefecture")}
              showMonitoringAlert={false}
              onChanged={() => {
                if (previewSlug) {
                  void getCityRulebookAction(previewSlug).then((r) => {
                    if (r.ok && r.data) setBook(r.data)
                  })
                }
              }}
            />
          </div>
        ) : (
          <p className="text-base text-muted-foreground">
            根拠情報を読み込めませんでした。根拠情報ページから置いてください。
          </p>
        )}
        <Button
          type="button"
          className="min-h-11"
          disabled={pending || !domainValue || Boolean(error)}
          onClick={() => onGenerate("shared")}
        >
          {pending && pendingLayer === "shared" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              資料を読んでいます…
            </>
          ) : (
            RULES_UI.composeNationalPrefectureRules
          )}
        </Button>
      </section>

      <section
        id="compose-city"
        className={cn(
          "space-y-4 rounded-xl border bg-card p-4 shadow-subtle sm:p-5",
          cityHighlight ? "border-accent/50" : "border-border"
        )}
        aria-labelledby="compose-city-heading"
      >
        <h2
          id="compose-city-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          2. 市
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          市固有の公式PDFから、自治体ルール案を作ります。国・県の確定後に進めてください。
        </p>
        <div className="space-y-2">
          <Label htmlFor="compose-city">自治体</Label>
          <Select
            value={jurisdictionId || undefined}
            onValueChange={setJurisdictionId}
          >
            <SelectTrigger id="compose-city" className="h-11 min-h-11">
              <SelectValue placeholder="自治体を選ぶ" />
            </SelectTrigger>
            <SelectContent>
              {municipalities.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {jurisdictionId && book ? (
          <CityRulebookSourcesPanel
            layer="city"
            layerLabel={book.city.name}
            jurisdictionId={book.layerJurisdictions.city?.id ?? null}
            sources={book.sources.filter((s) => s.layer === "city")}
            showMonitoringAlert={false}
            onChanged={() => {
              if (previewSlug) {
                void getCityRulebookAction(previewSlug).then((r) => {
                  if (r.ok && r.data) setBook(r.data)
                })
              }
            }}
          />
        ) : null}
        <Button
          type="button"
          className="min-h-11"
          disabled={pending || !domainValue || !jurisdictionId || Boolean(error)}
          onClick={() => onGenerate("city")}
        >
          {pending && pendingLayer === "city" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              資料を読んでいます…
            </>
          ) : (
            RULES_UI.composeCityRules
          )}
        </Button>
      </section>
    </div>
  )
}
