"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  listComposeOptionsAction,
  startComposeRulebookAction,
} from "@/app/actions/compose-rulebook"
import { ALL_DOMAINS_VALUE } from "@/lib/rule-engine/domains"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { RuleDomain } from "@/types/database"
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
import { AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  service: RuleServiceDef
}

export function ComposeRulebookForm({ service }: Props) {
  const router = useRouter()
  const [domains, setDomains] = useState<RuleDomain[]>([])
  const [municipalities, setMunicipalities] = useState<
    Array<{ id: string; name: string; slug: string | null }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [domainValue, setDomainValue] = useState<string>(ALL_DOMAINS_VALUE)
  const [jurisdictionId, setJurisdictionId] = useState("")
  const [pending, startTransition] = useTransition()

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
      if (result.data.municipalities[0]) {
        setJurisdictionId(result.data.municipalities[0].id)
      }
    })()
  }, [service.slug])

  function onGenerate() {
    startTransition(async () => {
      const result = await startComposeRulebookAction({
        serviceSlug: service.slug,
        domainValue,
        jurisdictionId,
      })
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "下書きを作れませんでした。")
        return
      }
      router.push(
        servicePath(service.slug, "compose", result.data.jobId)
      )
    })
  }

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
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="compose-domain-heading"
      >
        <h2
          id="compose-domain-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          領域
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <button
              type="button"
              className={cn(
                "flex min-h-11 w-full items-center rounded-xl border px-4 py-3 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                domainValue === ALL_DOMAINS_VALUE
                  ? "border-primary bg-primary/5 font-semibold text-primary-dark"
                  : "border-border"
              )}
              aria-pressed={domainValue === ALL_DOMAINS_VALUE}
              onClick={() => setDomainValue(ALL_DOMAINS_VALUE)}
            >
              全て
            </button>
          </li>
          {domains.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={cn(
                  "flex min-h-11 w-full flex-col items-start justify-center rounded-xl border px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  domainValue === d.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
                aria-pressed={domainValue === d.id}
                onClick={() => setDomainValue(d.id)}
              >
                <span className="text-base font-semibold text-primary-dark">
                  {d.title}
                </span>
                {d.description ? (
                  <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {d.description}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="compose-city-heading"
      >
        <h2
          id="compose-city-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          自治体
        </h2>
        <div className="space-y-2">
          <Label htmlFor="compose-city">提供する自治体</Label>
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
      </section>

      <Button
        type="button"
        className="min-h-11"
        disabled={pending || !jurisdictionId || Boolean(error)}
        onClick={onGenerate}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : null}
        下書きを作る
      </Button>
    </div>
  )
}
