import type { Metadata } from "next"
import Link from "next/link"
import { getRulebookSetupStatusAction } from "@/app/actions/rule-engine"
import { PurposeHub } from "@/components/features/admin/purpose-hub"
import { RulebookSetupGuide } from "@/components/features/admin/rules/rulebook-setup-guide"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, ArrowRight, BookOpen } from "lucide-react"

export const metadata: Metadata = {
  title: "ルールブック設定",
}

export const dynamic = "force-dynamic"

export default async function RegulatoryHubPage() {
  const section = getPurposeSection("rulebook")
  const setupResult = await getRulebookSetupStatusAction()

  if (!section) return null

  return (
    <div className="space-y-8">
      {setupResult.ok && setupResult.data ? (
        <RulebookSetupGuide readiness={setupResult.data} />
      ) : (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle />
          <AlertTitle>初回登録の状態を読み込めませんでした</AlertTitle>
          <AlertDescription>
            {setupResult.error ??
              "しばらくしてから再度お試しください。ルールエンジンのマイグレーション適用もご確認ください。"}
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4" aria-labelledby="city-rulebook-heading">
        <h2
          id="city-rulebook-heading"
          className="text-xl font-bold text-primary-dark"
        >
          閲覧・修正（Phase1市）
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          「この市で運営するならこのルールブック」を開きます。国・県・市の参照URLの登録・修正・削除、判定ルール案の生成・了承はここから進めます。
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHASE1_CITIES.map((city) => (
            <Link
              key={city.slug}
              href={`/admin/rules/regulatory/${city.slug}`}
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full rounded-lg shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="size-5" aria-hidden />
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground group-hover:text-primary"
                      aria-hidden
                    />
                  </div>
                  <CardTitle className="text-lg text-primary-dark">
                    {city.name}
                  </CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    国・{city.prefectureName}・{city.name}を束ねて確認する
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <PurposeHub section={section} linksOnly />
    </div>
  )
}
