import type { Metadata } from "next"
import Link from "next/link"
import {
  AlertTriangle,
  ClipboardList,
  FileSpreadsheet,
  Timer,
  type LucideIcon,
} from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "月次確認",
}

type MonthlyCard = {
  href: string
  icon: LucideIcon
  title: string
  description: string
  note: string
}

const MONTHLY_CARDS: MonthlyCard[] = [
  {
    href: "/attendance/import?kind=service_records",
    icon: FileSpreadsheet,
    title: "日報CSVを取り込む",
    description: "サービス提供記録（日報）のCSVを事業所データに取り込みます。",
    note: "請求CSVと照合する基準データになります。",
  },
  {
    href: "/attendance/import?kind=attendance",
    icon: Timer,
    title: "勤怠・タイムカードCSVを取り込む",
    description: "出勤・退勤のタイムカードCSVを事業所データに取り込みます。",
    note: "日報との時間ズレ確認に使います。",
  },
  {
    href: "/attendance",
    icon: AlertTriangle,
    title: "勤怠の矛盾を確認する",
    description:
      "取り込んだ日報と勤怠を突き合わせ、ズレや時間の重複の可能性を確認します。",
    note: "取り込んだ日報・勤怠データを使います。",
  },
  {
    href: "/billing-reconcile",
    icon: ClipboardList,
    title: "請求CSVを照合する",
    description:
      "国保連へ送る直前の請求CSVを、取り込んだ日報データと1分単位で照合します。",
    note: "請求CSVはサーバーに保存せず、ブラウザ内だけで処理します。",
  },
]

export default function MonthlyHubPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">月次確認</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          請求前に、請求CSVと日報・勤怠データの整合性を確認します。入れるデータごとに場所が分かれています。目的に合うカードを選んでください。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MONTHLY_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full rounded-lg shadow-sm transition-colors hover:border-primary/40">
                <CardHeader>
                  <Icon className="mb-2 size-8 text-primary" aria-hidden />
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {card.description}
                  </CardDescription>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {card.note}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
