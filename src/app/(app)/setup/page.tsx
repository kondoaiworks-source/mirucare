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
import { FacilitySettingsForm } from "@/components/features/setup/facility-settings-form"
import { PageHeader } from "@/components/features/layout/page-header"
import type { ServiceType } from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export const metadata: Metadata = {
  title: "事業所の設定",
}

export default async function SetupPage() {
  const profile = await getCurrentProfile()
  const org = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations
  const isAdmin = profile?.role === "admin"

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="事業所の設定"
        description="事業所名・サービス種別・自治体を確認・変更します。設定画面の「事業所情報」からも開けます。"
      />

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
            <Link href="/settings">設定に戻る</Link>
          </Button>
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
