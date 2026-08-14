"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getCityRulebookAction, type CityRulebookData } from "@/app/actions/city-rulebook"
import { listComposeOptionsAction } from "@/app/actions/compose-rulebook"
import { servicePath } from "@/lib/rule-engine/services"
import {
  collectRulebookSourceLinks,
  groupRulebookSourceLinks,
} from "@/lib/rule-engine/rulebook-source-links"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, ExternalLink } from "lucide-react"

type Props = {
  service: RuleServiceDef
  initialCitySlug?: string | null
}

type MunicipalityOption = {
  id: string
  name: string
  slug: string | null
}

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
      setLoading(true)
      setError(null)
      const result = await getCityRulebookAction(citySlug)
      if (cancelled) return
      if (!result.ok || !result.data) {
        setError(result.error ?? "資料先を開けませんでした。")
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
  }, [citySlug])

  function syncCityInUrl(nextSlug: string) {
    setCitySlug(nextSlug)
    const params = new URLSearchParams(searchParams.toString())
    if (nextSlug) params.set("city", nextSlug)
    else params.delete("city")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const sourceLinks = useMemo(
    () => (data ? collectRulebookSourceLinks(data) : []),
    [data]
  )
  const sourcesByLayer = useMemo(
    () => (data ? groupRulebookSourceLinks(data, sourceLinks) : []),
    [data, sourceLinks]
  )

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
          ルールブックを作るときに確認する、国・県・市の公式資料です。読むだけです。
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
      </section>

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
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5">
          {sourceLinks.length === 0 ? (
            <p className="text-base text-muted-foreground">
              この自治体の資料先はまだありません。
            </p>
          ) : (
            <div className="space-y-6">
              {sourcesByLayer.map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.layer} className="space-y-2">
                    <h2 className="text-lg font-semibold text-primary-dark">
                      {group.label}
                    </h2>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <li key={item.key}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 text-base text-primary underline-offset-4 hover:underline"
                          >
                            {item.title}
                            <ExternalLink
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
