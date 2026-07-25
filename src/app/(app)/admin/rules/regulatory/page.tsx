import type { Metadata } from "next"
import { PurposeHub } from "@/components/features/admin/purpose-hub"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { PHASE1_MUNICIPALITIES } from "@/lib/phase1-audit"

export const metadata: Metadata = {
  title: "ルールブック設定",
}

export default function RegulatoryHubPage() {
  const section = getPurposeSection("rulebook")
  if (!section) return null
  return (
    <div className="space-y-6">
      <Alert className="rounded-xl border-primary/20 bg-primary/[0.03]">
        <Info />
        <AlertTitle>Phase1 のルールブック範囲</AlertTitle>
        <AlertDescription className="space-y-2 text-base leading-relaxed">
          <p>
            サービスはいま<strong>訪問介護</strong>です。自治体は国・県に加え、次の市を優先します。
          </p>
          <p className="font-medium text-primary-dark">
            {PHASE1_MUNICIPALITIES.join("・")}
          </p>
          <p className="text-sm text-muted-foreground">
            市ごとの「閲覧・修正」専用画面は今後追加します。当面は下の参照URL・行政資料から国／県／市を登録し、更新アラートを人が確認してください。
          </p>
        </AlertDescription>
      </Alert>
      <PurposeHub section={section} />
    </div>
  )
}
