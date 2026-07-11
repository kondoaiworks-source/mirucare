import type { Metadata } from "next"
import Link from "next/link"
import { getCurrentProfile } from "@/app/actions/auth"
import { isCurrentUserOperator } from "@/lib/operator"
import {
  InviteForm,
  SignOutButton,
} from "@/components/features/settings/invite-form"
import { SkipReviewToggle } from "@/components/features/settings/skip-review-toggle"
import { BillingPortalButton } from "@/components/features/billing/billing-buttons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BILLING_UI, planLabel } from "@/lib/plans"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export const metadata: Metadata = {
  title: "設定",
}

type PageProps = {
  searchParams: Promise<{ billing?: string }> | { billing?: string }
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = await Promise.resolve(searchParams)
  const [profile, isOperator] = await Promise.all([
    getCurrentProfile(),
    isCurrentUserOperator(),
  ])
  const org = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations

  const plan = org?.plan ?? "none"
  const isViewOnly = plan === "none"
  const hasStripeCustomer = Boolean(org?.stripe_customer_id)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">設定</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          事業所情報の確認と、同僚の招待ができます。
        </p>
      </div>

      {params.billing === "success" ? (
        <Alert className="rounded-lg">
          <Info />
          <AlertTitle>ご契約ありがとうございます</AlertTitle>
          <AlertDescription>
            プランの反映には数秒かかることがあります。画面を更新してご確認ください。
          </AlertDescription>
        </Alert>
      ) : null}

      {isViewOnly ? (
        <Alert className="rounded-lg">
          <Info />
          <AlertTitle>{BILLING_UI.viewOnlyTitle}</AlertTitle>
          <AlertDescription>{BILLING_UI.viewOnlyBody}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">ご契約プラン</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            カード変更・解約はStripeのお客様ポータルから行えます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">現在のプラン</p>
            <p className="text-2xl font-bold tabular-nums text-primary-dark">
              {planLabel(plan)}
            </p>
            {org?.stripe_subscription_status ? (
              <p className="mt-1 text-sm text-muted-foreground">
                ステータス：{org.stripe_subscription_status}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link href="/pricing">
                {isViewOnly
                  ? BILLING_UI.reSubscribeCta
                  : "プランを確認・変更する"}
              </Link>
            </Button>
            {profile?.role === "admin" && hasStripeCustomer ? (
              <BillingPortalButton label={BILLING_UI.portalCta} />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">事業所情報</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            ログイン中のアカウントに紐づく事業所です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-base">
          <div>
            <p className="text-sm text-muted-foreground">事業所名</p>
            <p className="font-semibold">{org?.name ?? "未設定"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              サービス種別（訪問介護／通所介護など）
            </p>
            <p className="font-semibold">{org?.service_type ?? "未設定"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              自治体（チェック基準の選択に使用）
            </p>
            <p className="font-semibold">
              {org?.municipality
                ? `${org.municipality}のローカル基準でチェックします`
                : "未設定（あとで設定できます）"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">あなたの役割</p>
            <p className="font-semibold">
              {profile?.role === "admin" ? "管理者" : "スタッフ"}
            </p>
          </div>
        </CardContent>
      </Card>

      {profile?.role === "admin" ? (
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">チェック結果の公開</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              AIの指摘を、公開前に人が確認するかどうかを選べます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SkipReviewToggle
              initialSkip={org?.skip_finding_review !== false}
            />
          </CardContent>
        </Card>
      ) : null}

      {profile?.role === "admin" ? (
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">月次レポート管理</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              原因分析はAI自動生成ではなく、管理者が手入力で作成します。「レポート管理」からMarkdownで保存すると、プレミアムの月次レポートに表示されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/admin/reports">レポート管理を開く</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOperator ? (
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">運営レビューコンソール</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              AI指摘の承認・却下と、フィードバック対応メモ（運営のみ）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <Link href="/admin">レビューコンソールを開く</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <InviteForm isAdmin={profile?.role === "admin"} />

      <SignOutButton />
    </div>
  )
}
