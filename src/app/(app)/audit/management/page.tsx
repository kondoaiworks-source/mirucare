import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export const metadata: Metadata = {
  title: "運営AI監査",
}

export default function AuditManagementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          運営AI監査
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          人員配置・研修・委員会など事業所全体の確認（第3フェーズ予定）です。
        </p>
      </div>
      <Alert className="rounded-lg">
        <Info />
        <AlertTitle>準備中です</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          職員の氏名などが含まれやすいため、匿名化を強化したうえで公開予定です。いまは「運用AI監査」をご利用ください。
        </AlertDescription>
      </Alert>
      <Button asChild size="lg" variant="outline">
        <Link href="/audit/operations">運用AI監査を開く</Link>
      </Button>
    </div>
  )
}
