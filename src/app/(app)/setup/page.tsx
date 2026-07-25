import type { Metadata } from "next"
import Link from "next/link"
import { getCurrentProfile } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PHASE1_MUNICIPALITIES } from "@/lib/phase1-audit"
import { FacilitySettingsForm } from "@/components/features/setup/facility-settings-form"
import type { ServiceType } from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export const metadata: Metadata = {
  title: "初期設定",
}

export default async function SetupPage() {
  const profile = await getCurrentProfile()
  const org = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations
  const isAdmin = profile?.role === "admin"

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          初期設定
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          事業所の情報を確認・変更します。第1フェーズは訪問介護と神奈川の対象市が中心です。ご自身のお名前は「設定」から変更できます。
        </p>
      </div>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">事業所の設定</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            事業所名は施設共通です。同じ事業所のスタッフ全員に同じ名前が表示されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FacilitySettingsForm
            canEdit={Boolean(isAdmin)}
            currentName={org?.name ?? ""}
            currentServiceType={(org?.service_type as ServiceType | null) ?? null}
            currentMunicipality={org?.municipality ?? null}
          />
          <Button asChild size="lg" variant="outline">
            <Link href="/settings">あなたの表示名やその他の設定を開く</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">Phase1 の対象範囲</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            介護サービスは訪問介護、自治体は次の市を優先対応しています（国・県ルールも併用）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-base leading-relaxed">
            {PHASE1_MUNICIPALITIES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Alert className="rounded-lg">
        <Info />
        <AlertTitle>個人情報について</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          保存されるのは公開URL・ルールブック本文と、匿名化した監査結果などです。利用者マスタの継続保存は行いません。詳細は運用方針に従います。
        </AlertDescription>
      </Alert>
    </div>
  )
}
