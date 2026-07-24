import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PHASE1_OPERATION_CHECKS } from "@/lib/phase1-audit"

export const metadata: Metadata = {
  title: "運用AI監査",
}

export default function AuditOperationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          運用AI監査
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          一時アップロードした書類を、自治体ルールブックに照らして整合性を確認します（第1フェーズ）。合否や返還は保証しません。
        </p>
      </div>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">今回確認する項目</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Phase1では次の項目を中心に確認します。指摘は「可能性」としてご確認ください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-base leading-relaxed">
            {PHASE1_OPERATION_CHECKS.map((item) => (
              <li key={item.no}>
                <span className="font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  — {item.description}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-primary/20 bg-primary/5 shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">監査を始める</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            書類をアップロードし、同意のうえで監査を開始します。原本は完了後に削除されます（再確認用に最大7日残すことも選べます）。結果は匿名表記で残ります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <Link href="/check/upload">監査書類をアップロードする</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
