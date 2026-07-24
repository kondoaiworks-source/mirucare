"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateFacilityMunicipalityAction } from "@/app/actions/facility-setup"
import { PHASE1_MUNICIPALITIES } from "@/lib/phase1-audit"
import { Button } from "@/components/ui/button"
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
  currentMunicipality: string | null
}

export function FacilityMunicipalityForm({
  canEdit,
  currentMunicipality,
}: Props) {
  const initial =
    currentMunicipality &&
    (PHASE1_MUNICIPALITIES as readonly string[]).includes(currentMunicipality)
      ? currentMunicipality
      : currentMunicipality
        ? currentMunicipality
        : SKIP
  const [value, setValue] = useState(initial || SKIP)
  const [pending, startTransition] = useTransition()

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        自治体の変更は管理者のみ行えます。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="facility-municipality">対応自治体（Phase1）</Label>
        <Select value={value} onValueChange={setValue} disabled={pending}>
          <SelectTrigger id="facility-municipality" className="min-h-11">
            <SelectValue placeholder="自治体を選ぶ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SKIP}>まだ決まっていない（全国寄り）</SelectItem>
            {PHASE1_MUNICIPALITIES.map((name) => (
              <SelectItem key={name} value={name}>
                神奈川県 {name}
              </SelectItem>
            ))}
            {currentMunicipality &&
            !(PHASE1_MUNICIPALITIES as readonly string[]).includes(
              currentMunicipality
            ) ? (
              <SelectItem value={currentMunicipality}>
                {currentMunicipality}（Phase1対象外・変更推奨）
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateFacilityMunicipalityAction({
              municipality: value === SKIP ? null : value,
              skipMunicipality: value === SKIP,
            })
            if (!result.ok) {
              toast.error(result.error ?? "保存できませんでした。")
              return
            }
            toast.success("自治体の設定を保存しました。")
          })
        }}
      >
        {pending ? "保存しています…" : "自治体を保存する"}
      </Button>
    </div>
  )
}
