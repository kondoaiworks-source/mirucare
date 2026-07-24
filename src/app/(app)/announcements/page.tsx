import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AppAnnouncement } from "@/types/database"

export const metadata: Metadata = {
  title: "ルールブック更新お知らせ",
}

export default async function AnnouncementsPage() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("app_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  const rows = (data ?? []) as AppAnnouncement[]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          自治体ルールブック更新お知らせ
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          国・自治体の公開情報の更新を、運営が確認したうえでお知らせします。個人情報は含まれません。
        </p>
      </div>

      {error ? (
        <p className="text-base text-danger">
          お知らせを取得できませんでした。しばらくしてから再度お試しください。
        </p>
      ) : null}

      {rows.length === 0 && !error ? (
        <Card className="rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">お知らせはまだありません</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              ルールブックに反映された更新があると、ここに表示されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" variant="outline">
              <Link href="/">ホームに戻る</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="rounded-lg shadow-subtle">
                <CardHeader>
                  <CardTitle className="text-lg leading-snug">
                    {row.title}
                  </CardTitle>
                  <CardDescription className="text-sm tabular-nums">
                    {new Date(row.created_at).toLocaleString("ja-JP")}
                  </CardDescription>
                </CardHeader>
                {row.body ? (
                  <CardContent>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                      {row.body}
                    </p>
                  </CardContent>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
