"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  Home,
  Users,
  MapPin,
  FileCheck2,
} from "lucide-react"
import { completeOnboardingAction } from "@/app/actions/auth"
import { SERVICE_TYPE_OPTIONS, municipalitiesForOnboarding } from "@/lib/municipalities"
import type { ServiceType } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

const ICONS = {
  Home,
  Users,
  Building2,
} as const

const TOTAL_STEPS = 3

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [serviceType, setServiceType] = useState<ServiceType | null>(null)
  const [municipality, setMunicipality] = useState("")
  const [municipalityQuery, setMunicipalityQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const progress = (step / TOTAL_STEPS) * 100

  const filteredMunicipalities = useMemo(() => {
    const q = municipalityQuery.trim()
    const list = municipalitiesForOnboarding()
    if (!q) return list.slice(0, 12)
    return list.filter((m) => m.label.includes(q)).slice(0, 20)
  }, [municipalityQuery])

  function goNextFromStep1() {
    setError(null)
    if (name.trim().length < 2) {
      setError(
        "事業所名が短すぎます。正式名称を2文字以上で入力してください（例：みらい訪問介護ステーション）。"
      )
      return
    }
    if (!serviceType) {
      setError(
        "サービス種別が未選択です。当てはまるカードをタップして選んでください。"
      )
      return
    }
    setStep(2)
  }

  function finish(skipMunicipality: boolean) {
    if (!serviceType) return
    setError(null)

    startTransition(async () => {
      const result = await completeOnboardingAction({
        name,
        serviceType,
        municipality: skipMunicipality ? null : municipality,
        skipMunicipality,
      })

      if (!result.ok) {
        setError(result.error ?? "設定を保存できませんでした。")
        return
      }
      setStep(3)
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto max-w-lg">
          <p className="text-sm font-medium text-muted-foreground">
            初期設定 {step}/{TOTAL_STEPS}
          </p>
          <Progress value={progress} className="mt-2 h-2" aria-label="進捗" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 pb-28">
        {error ? (
          <Alert variant="destructive" className="mb-4 rounded-lg">
            <AlertCircle />
            <AlertTitle>入力内容をご確認ください</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === 1 ? (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                事業所を登録する
              </h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                事業所名と、主なサービス種別を選んでください。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-name">事業所名</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="みらい訪問介護ステーション"
                className="h-12 rounded-lg text-base"
                autoComplete="organization"
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">サービス種別</legend>
              <div className="grid gap-3">
                {SERVICE_TYPE_OPTIONS.map((option) => {
                  const Icon = ICONS[option.icon as keyof typeof ICONS]
                  const selected = serviceType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setServiceType(option.value)}
                      className={cn(
                        "flex min-h-[72px] items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/60"
                      )}
                      aria-pressed={selected}
                    >
                      <span
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-lg",
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface text-primary"
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-base font-semibold text-foreground">
                          {option.title}
                        </span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                所在地の自治体を選ぶ
              </h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                実地指導（運営指導）のローカル基準の参考に使います。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipality-search">自治体を検索</Label>
              <Input
                id="municipality-search"
                value={municipalityQuery}
                onChange={(e) => setMunicipalityQuery(e.target.value)}
                placeholder="例：横浜、世田谷"
                className="h-12 rounded-lg text-base"
              />
            </div>

            <div className="grid max-h-72 gap-2 overflow-y-auto">
              {filteredMunicipalities.map((m) => {
                const selected = municipality === m.name
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMunicipality(m.name)}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-lg border px-4 py-3 text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected
                        ? "border-primary bg-primary/5 font-semibold text-primary"
                        : "border-border bg-background hover:bg-muted/60"
                    )}
                    aria-pressed={selected}
                  >
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    {m.label}
                  </button>
                )
              })}
            </div>

            {municipality ? (
              <p className="rounded-lg bg-primary/10 px-4 py-3 text-base leading-relaxed text-primary-dark">
                <span className="font-semibold">{municipality}</span>
                のローカル基準でチェックします
              </p>
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-1 flex-col items-center justify-center space-y-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CheckCircle2 className="size-9" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark">
                設定が完了しました
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                まずは書類を1枚チェックしてみましょう。
                <br />
                CSV・PDF・スマホ写真に対応しています。
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left">
              <FileCheck2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                本サービスはWチェック支援です。最終判断・提出は貴施設の責任で行ってください。
              </p>
            </div>
          </section>
        ) : null}
      </main>

      {/* 片手操作：主要ボタンを画面下部に固定 */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {step === 1 ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={goNextFromStep1}
            >
              次へ進む
            </Button>
          ) : null}

          {step === 2 ? (
            <>
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending || !municipality}
                onClick={() => finish(false)}
              >
                {pending ? "保存しています…" : "この自治体で設定する"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => finish(true)}
              >
                あとで設定
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending}
                onClick={() => setStep(1)}
              >
                戻る
              </Button>
            </>
          ) : null}

          {step === 3 ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => router.push("/check/upload")}
            >
              書類をアップロードする
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
