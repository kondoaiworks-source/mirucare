import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export const metadata: Metadata = {
  title: "法令AI監査",
}

export default function AuditLegalPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          法令AI監査
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          運営規程・重要事項説明書など、法令・通知との適合確認（第2フェーズ予定）です。
        </p>
      </div>
      <Alert className="rounded-lg">
        <Info />
        <AlertTitle>準備中です</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          いまは第1フェーズの「運用AI監査」をご利用ください。個人情報を含みにくい書類が中心の機能として、順次公開予定です。
        </AlertDescription>
      </Alert>
      <Button asChild size="lg" variant="outline">
        <Link href="/audit/operations">運用AI監査を開く</Link>
      </Button>
    </div>
  )
}
