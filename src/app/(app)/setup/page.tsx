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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          初期設定
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          どのサービスを、どの自治体で提供しているかを確認します。第1フェーズは訪問介護と神奈川の対象市が中心です。
        </p>
      </div>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">事業所の設定</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            オンボーディングで登録した内容です。変更が必要な場合は設定からご確認ください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-base leading-relaxed">
          <p>
            <span className="text-muted-foreground">事業所名：</span>
            <span className="font-semibold">
              {org?.name ?? "（未設定）"}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">サービス種別：</span>
            <span className="font-semibold">
              {org?.service_type ?? "（未設定）"}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">自治体：</span>
            <span className="font-semibold">
              {org?.municipality ?? "（未設定・全国ルール）"}
            </span>
          </p>
          <Button asChild size="lg" variant="outline">
            <Link href="/settings">設定を開く</Link>
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
