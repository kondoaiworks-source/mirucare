import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { getCurrentProfile } from "@/app/actions/auth"
import { isCurrentUserOperator } from "@/lib/operator"
import {
  InviteForm,
  SignOutButton,
} from "@/components/features/settings/invite-form"
import { SkipReviewToggle } from "@/components/features/settings/skip-review-toggle"
import { UnlockLoginPanel } from "@/components/features/settings/unlock-login-panel"
import { DisplayNameForm } from "@/components/features/settings/display-name-form"
import { BillingPortalButton } from "@/components/features/billing/billing-buttons"
import { SettingsSkeleton } from "@/components/features/skeletons/page-skeletons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BILLING_UI, planLabel } from "@/lib/plans"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  Info,
  Lock,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react"

export const metadata: Metadata = {
  title: "設定",
}

type PageProps = {
  searchParams: Promise<{ billing?: string }> | { billing?: string }
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-muted-foreground">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      {children}
    </h2>
  )
}

function CardTitleWithIcon({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-lg">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </CardTitle>
  )
}

export default function SettingsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function SettingsContent({ searchParams }: PageProps) {
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
  const isAdmin = profile?.role === "admin"

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">設定</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          ご自身の表示名・事業所情報の確認、同僚の招待ができます。
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

      <section className="space-y-4">
        <SectionHeading icon={UserRound}>あなた自身</SectionHeading>
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitleWithIcon icon={UserRound}>表示名</CardTitleWithIcon>
            <CardDescription className="text-base leading-relaxed">
              事業所名とは別に、ログイン中のスタッフ個人のお名前を保存します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DisplayNameForm
              currentDisplayName={profile?.display_name ?? ""}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading icon={CreditCard}>契約・事業所</SectionHeading>
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitleWithIcon icon={CreditCard}>ご契約プラン</CardTitleWithIcon>
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
              {isAdmin && hasStripeCustomer ? (
                <BillingPortalButton label={BILLING_UI.portalCta} />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitleWithIcon icon={Building2}>事業所情報</CardTitleWithIcon>
            <CardDescription className="text-base leading-relaxed">
              施設共通の情報です。変更は「初期設定」から行えます（管理者のみ）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-base">
            <div>
              <p className="text-sm text-muted-foreground">事業所名（施設共通）</p>
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
                {isAdmin ? "管理者" : "スタッフ"}
              </p>
            </div>
            <Button asChild size="lg" variant="outline">
              <Link href="/setup">事業所の設定を変更する</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {isAdmin ? (
        <>
          <Separator />
          <section className="space-y-4">
            <SectionHeading icon={ShieldCheck}>管理者向けメニュー</SectionHeading>
            <Card className="rounded-lg shadow-subtle">
              <CardHeader>
                <CardTitleWithIcon icon={ShieldCheck}>
                  チェック結果の公開
                </CardTitleWithIcon>
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

            <Card className="rounded-lg shadow-subtle">
              <CardHeader>
                <CardTitleWithIcon icon={BarChart3}>
                  月次レポート管理
                </CardTitleWithIcon>
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

            <InviteForm isAdmin={isAdmin} />
          </section>
        </>
      ) : (
        <InviteForm isAdmin={isAdmin} />
      )}

      {(isAdmin || isOperator) ? (
        <>
          <Separator />
          <section className="space-y-4">
            <SectionHeading icon={Lock}>ログインセキュリティ</SectionHeading>
            <UnlockLoginPanel canManage />
          </section>
        </>
      ) : null}

      {isOperator ? (
        <>
          <Separator />
          <section className="space-y-4">
            <SectionHeading icon={ClipboardList}>運営向け</SectionHeading>
            <Card className="rounded-lg shadow-subtle">
              <CardHeader>
                <CardTitleWithIcon icon={ClipboardList}>
                  運営レビューコンソール
                </CardTitleWithIcon>
                <CardDescription className="text-base leading-relaxed">
                  AI指摘の承認・却下と、フィードバック対応メモ（運営のみ）。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg">
                  <Link href="/admin">レビューコンソールを開く</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/admin/rules">チェック設定を開く</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/admin/rules/documents">行政資料を開く</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/admin/document-changes">マニュアル変更の承認</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      <Separator />
      <SignOutButton />
    </div>
  )
}
