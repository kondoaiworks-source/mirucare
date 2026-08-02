"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "@/components/ui/sonner"
import { updateFacilitySettingsAction } from "@/app/actions/facility-setup"
import { getPublishedRulebookCatalogAction } from "@/app/actions/rulebook-offerings"
import { SERVICE_TYPE_OPTIONS } from "@/lib/municipalities"
import type { PublishedCatalog } from "@/lib/rule-engine/offerings"
import type { ServiceType } from "@/types/database"
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

const SKIP = "__skip__"

type Props = {
  canEdit: boolean
  currentName: string
  currentServiceType: ServiceType | null
  currentMunicipality: string | null
}

export function FacilitySettingsForm({
  canEdit,
  currentName,
  currentServiceType,
  currentMunicipality,
}: Props) {
  const [name, setName] = useState(currentName)
  const [serviceType, setServiceType] = useState<ServiceType>(
    currentServiceType ?? "訪問介護"
  )
  const [municipality, setMunicipality] = useState(
    currentMunicipality?.trim() || SKIP
  )
  const [catalog, setCatalog] = useState<PublishedCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void (async () => {
      const result = await getPublishedRulebookCatalogAction()
      if (!result.ok || !result.data) {
        setCatalogError(
          result.error ?? "公開中の自治体一覧を取得できませんでした。"
        )
        return
      }
      setCatalog(result.data)
      setCatalogError(null)
    })()
  }, [])

  const serviceOptions = useMemo(() => {
    const published = new Set(catalog?.services ?? [])
    return SERVICE_TYPE_OPTIONS.filter(
      (o) =>
        published.has(o.value) ||
        (currentServiceType != null && o.value === currentServiceType)
    )
  }, [catalog, currentServiceType])

  const municipalityOptions = useMemo(() => {
    const published = catalog?.municipalitiesByService[serviceType] ?? []
    const names = new Set(published.map((m) => m.name))
    const list = [...published]
    if (
      currentMunicipality?.trim() &&
      !names.has(currentMunicipality.trim()) &&
      serviceType === (currentServiceType ?? serviceType)
    ) {
      list.push({
        name: currentMunicipality.trim(),
        prefectureName: "",
        label: `${currentMunicipality.trim()}（現在の設定・公開終了済み）`,
      })
    }
    return list
  }, [catalog, serviceType, currentMunicipality, currentServiceType])

  if (!canEdit) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-base leading-relaxed">
        <p>
          <span className="text-muted-foreground">事業所名：</span>
          <span className="font-semibold">{currentName || "（未設定）"}</span>
        </p>
        <p>
          <span className="text-muted-foreground">サービス種別：</span>
          <span className="font-semibold">
            {currentServiceType ?? "（未設定）"}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">現在の自治体：</span>
          <span className="font-semibold">
            {currentMunicipality ?? "（未設定・全国ルール）"}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          事業所の設定変更は管理者のみ行えます。ご自身のお名前は「設定」から変更できます。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="facility-name">事業所名</Label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          施設の正式名称です。スタッフ個人のお名前とは別に保存されます。
        </p>
        <Input
          id="facility-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="みらい訪問介護ステーション"
          className="h-12 rounded-lg text-base"
          autoComplete="organization"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facility-service-type">サービス種別</Label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          運営が公開したサービスだけ選べます。
        </p>
        <Select
          value={serviceType}
          onValueChange={(v) => {
            const next = v as ServiceType
            setServiceType(next)
            const allowed =
              catalog?.municipalitiesByService[next]?.some(
                (m) => m.name === municipality
              ) ?? false
            if (municipality !== SKIP && !allowed) {
              setMunicipality(SKIP)
            }
          }}
          disabled={pending || !catalog}
        >
          <SelectTrigger id="facility-service-type" className="min-h-11">
            <SelectValue placeholder="サービス種別を選ぶ" />
          </SelectTrigger>
          <SelectContent>
            {serviceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="facility-municipality">対応自治体</Label>
        <p className="text-sm leading-relaxed text-muted-foreground">
          公開中の自治体から選びます。公開が終わった自治体でも、いまの設定はそのまま残せます。
        </p>
        <Select
          value={municipality}
          onValueChange={setMunicipality}
          disabled={pending || !catalog}
        >
          <SelectTrigger id="facility-municipality" className="min-h-11">
            <SelectValue placeholder="自治体を選ぶ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SKIP}>まだ決まっていない（全国寄り）</SelectItem>
            {municipalityOptions.map((m) => (
              <SelectItem key={m.name} value={m.name}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {catalogError ? (
          <p className="text-sm text-danger">{catalogError}</p>
        ) : null}
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending || !catalog}
        onClick={() => {
          startTransition(async () => {
            const result = await updateFacilitySettingsAction({
              name,
              serviceType,
              municipality: municipality === SKIP ? null : municipality,
              skipMunicipality: municipality === SKIP,
            })
            if (!result.ok) {
              toast.error(result.error ?? "保存できませんでした。")
              return
            }
            toast.success("事業所の設定を保存しました。")
          })
        }}
      >
        {pending ? "保存しています…" : "この内容を保存する"}
      </Button>
    </div>
  )
}
