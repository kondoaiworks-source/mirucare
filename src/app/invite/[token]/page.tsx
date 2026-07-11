import type { Metadata } from "next"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { InviteAcceptForm } from "@/components/features/auth/invite-accept-form"
import { AppFooter } from "@/components/features/layout/app-footer"
import Link from "next/link"

export const metadata: Metadata = {
  title: "招待を受ける",
}

type PageProps = {
  params: { token: string }
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = params
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 招待情報は token で取得（未ログインでも内容を表示するため service role）
  let invitation: {
    email: string
    organization_id: string
    status: string
    expires_at: string
  } | null = null
  let organizationName = "事業所"

  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from("invitations")
      .select("email, organization_id, status, expires_at, organizations(name)")
      .eq("token", token)
      .is("deleted_at", null)
      .maybeSingle()

    if (data) {
      invitation = data
      const org = data.organizations as { name?: string } | { name?: string }[] | null
      if (Array.isArray(org)) {
        organizationName = org[0]?.name ?? organizationName
      } else {
        organizationName = org?.name ?? organizationName
      }
    }
  } catch {
    // 環境変数未設定時はフォールバック表示
  }

  const isExpired =
    invitation &&
    (invitation.status !== "pending" ||
      new Date(invitation.expires_at) < new Date())

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border bg-background px-4 py-4">
        <Link href="/login" className="text-base font-bold text-primary-dark">
          監査のミカタ
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        {!invitation || isExpired ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-primary-dark">
              招待リンクが無効です
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              招待リンクが無効か、有効期限切れです。招待者に再送をご依頼ください。
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
            >
              ログイン画面へ戻る
            </Link>
          </div>
        ) : (
          <InviteAcceptForm
            token={token}
            email={invitation.email}
            organizationName={organizationName}
            isLoggedIn={Boolean(user)}
            emailMatches={
              Boolean(user?.email) &&
              user!.email!.toLowerCase() === invitation.email.toLowerCase()
            }
          />
        )}
      </main>
      <AppFooter />
    </div>
  )
}
