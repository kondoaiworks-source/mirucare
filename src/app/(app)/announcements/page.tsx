import type { Metadata } from "next"
import Link from "next/link"
import { Megaphone, PenLine } from "lucide-react"
import { getCurrentProfile } from "@/app/actions/auth"
import {
  listAnnouncementsAction,
  markAnnouncementsSeenAction,
} from "@/app/actions/announcements"
import { SectionCard } from "@/components/features/layout/section-card"
import { PageHeader } from "@/components/features/layout/page-header"
import { FacilityAnnouncementForm } from "@/components/features/announcements/facility-announcement-form"
import { Button } from "@/components/ui/button"
import { OPS_HOME_UI } from "@/lib/copy/home-ui"
import type { AppAnnouncement } from "@/types/database"

export const metadata: Metadata = {
  title: "お知らせ",
}

function KindLabel({ row }: { row: AppAnnouncement }) {
  const isFacility = Boolean(row.organization_id)
  return (
    <span className="rounded-lg border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {isFacility ? OPS_HOME_UI.kindFacility : OPS_HOME_UI.kindRuleUpdate}
    </span>
  )
}

export default async function AnnouncementsPage() {
  await markAnnouncementsSeenAction()

  const [profile, listed] = await Promise.all([
    getCurrentProfile(),
    listAnnouncementsAction(50),
  ])
  const isAdmin = profile?.role === "admin"
  const announcements = listed.data?.announcements ?? []
  const canPost = Boolean(listed.data?.canPost && isAdmin)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="お知らせ"
        description="ルール更新と、事業所からの連絡です。"
        action={
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/">運用AI監査に戻る</Link>
          </Button>
        }
      />

      <SectionCard
        icon={Megaphone}
        title="お知らせ"
        description="新しい順に表示します。"
      >
        {!listed.ok ? (
          <p className="text-base text-danger">
            {listed.error ?? "お知らせを取得できませんでした。"}
          </p>
        ) : announcements.length === 0 ? (
          <p className="text-base text-muted-foreground">
            {OPS_HOME_UI.announcementsEmpty}
          </p>
        ) : (
          <ul className="space-y-3">
            {announcements.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-surface px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <KindLabel row={row} />
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("ja-JP")}
                  </span>
                </div>
                <p className="mt-2 text-lg font-bold leading-snug text-primary-dark">
                  {row.title}
                </p>
                {row.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground">
                    {row.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canPost ? (
        <SectionCard
          id="post"
          icon={PenLine}
          title="お知らせを投稿する"
          description="自分と招待したメンバーに届きます（個人情報は書かないでください）。"
        >
          <FacilityAnnouncementForm />
        </SectionCard>
      ) : null}
    </div>
  )
}
