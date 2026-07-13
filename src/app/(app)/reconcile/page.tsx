import type { Metadata } from "next"
import Link from "next/link"
import { ClipboardList, FileSpreadsheet } from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "突合・矛盾検知",
}

export default function ReconcileHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">突合・矛盾検知</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          勤怠の矛盾確認と、請求CSVの1分単位突合（端末内処理）を行えます。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/attendance"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full rounded-lg shadow-sm transition-colors hover:border-primary/40">
            <CardHeader>
              <ClipboardList className="mb-2 size-8 text-primary" aria-hidden />
              <CardTitle className="text-lg">勤怠の矛盾を検知する</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                日報の時間重複や、タイムカード退勤とのズレの可能性を確認します。
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link
          href="/billing-reconcile"
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full rounded-lg shadow-sm transition-colors hover:border-primary/40">
            <CardHeader>
              <FileSpreadsheet
                className="mb-2 size-8 text-primary"
                aria-hidden
              />
              <CardTitle className="text-lg">請求CSVを突合する</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                国保連送信前のCSVをブラウザ内だけで日報と照合します（サーバー未保存）。
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
