import Link from "next/link"
import {
  Bell,
  BookOpen,
  ExternalLink,
  FileSearch,
  Hourglass,
  ShieldCheck,
} from "lucide-react"
import type {
  CityRulebookCheckRule,
  CityRulebookData,
} from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CategoryPdfReviewPanel } from "@/components/features/admin/rules/category-pdf-review-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ruleMatchesAuditCategory,
  type AuditCategoryDef,
} from "@/lib/rule-engine/audit-categories"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"

type Props = {
  service: RuleServiceDef
  category: AuditCategoryDef
  data: CityRulebookData
}

function RuleList({
  rules,
  emptyLabel,
}: {
  rules: CityRulebookCheckRule[]
  emptyLabel: string
}) {
  if (rules.length === 0) {
    return (
      <p className="text-base leading-relaxed text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {rules.map((r) => (
        <li
          key={r.versionId}
          className="rounded-xl border border-border bg-muted/20 px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-primary-dark">{r.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {r.code} ／ v{r.versionNo}
              </p>
            </div>
            <Badge
              variant={
                r.reviewStatus === "approved" ? "default" : "outline"
              }
              className="rounded-md"
            >
              {r.reviewStatus === "approved" ? "ルールブック登録済" : "了承待ち"}
            </Badge>
          </div>
          {r.sourceDocumentUrl || r.sourceDocumentTitle ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              根拠:{" "}
              {r.sourceDocumentUrl ? (
                <a
                  href={r.sourceDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
                  {r.sourceDocumentTitle ?? "公開情報"}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                r.sourceDocumentTitle
              )}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * 監査カテゴリ詳細：関連PDF採用／更新情報管理／ルール設定。
 */
export function AuditCategoryDetail({ service, category, data }: Props) {
  const { city, documents, pendingDrafts, openAlerts } = data
  const cityHref = servicePath(service.slug, "municipalities", city.slug)
  const categoriesHref = `${cityHref}/audit-categories`

  const approved = data.approvedCheckRules.filter((r) =>
    ruleMatchesAuditCategory(r, category)
  )
  const pending = data.pendingCheckRules.filter((r) =>
    ruleMatchesAuditCategory(r, category)
  )

  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb
          items={[
            { label: service.label, href: servicePath(service.slug) },
            {
              label: "市区町村ルール設定",
              href: servicePath(service.slug, "municipalities"),
            },
            { label: city.name, href: cityHref },
            { label: "監査カテゴリ設定", href: categoriesHref },
            { label: category.title },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">
              {category.operationCheckNo != null
                ? `項目 ${category.operationCheckNo}`
                : "追加カテゴリ"}
            </p>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              {category.title}
            </h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSearch className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg text-primary-dark">
              関連PDFの確認
            </CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            関連する公開情報を検索し、内容を確認してから「採用」「不採用」を選びます。採用したものは台帳に登録され、1日1回の自動監視が始まります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CategoryPdfReviewPanel
            serviceSlug={service.slug}
            citySlug={city.slug}
            categorySlug={category.slug}
          />
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button asChild variant="outline" className="min-h-11">
              <Link href={cityHref}>市の公開情報を編集する</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={servicePath(service.slug, "national-prefecture")}>
                国・県を編集する
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg text-primary-dark">
              【更新情報管理】
            </CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            採用して台帳に載った公開情報の更新を確認し、反映します。差分の了承は更新アラートから行えます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">台帳資料（市関連）</p>
              <p className="text-2xl font-bold tabular-nums text-primary-dark">
                {documents.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">差分（確認待ち）</p>
              <p className="text-2xl font-bold tabular-nums text-primary-dark">
                {pendingDrafts.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">未解消アラート</p>
              <p className="text-2xl font-bold tabular-nums text-primary-dark">
                {openAlerts.length}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link href="/admin/document-changes">
                更新アラートを確認する
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/admin/rules/documents?city=${city.slug}`}>
                公開情報監視を開く
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/admin/rules/notifications">
                公開情報台帳管理へ
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg text-primary-dark">
              ルール設定
            </CardTitle>
          </div>
          <CardDescription className="text-base leading-relaxed">
            AIが作成した判定ルール案を人が確認し、「採用」したものだけがルールブックへ登録されます。横断の「ルール管理」キューでも了承できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-base leading-relaxed text-muted-foreground">
            新しい案を出すときは、市の設定または国・県ルール設定の「判定ルール案を生成する」を使います。生成された案は下と横断のルール管理に現れます。
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href={cityHref}>市の設定で案を生成する</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link
                  href={servicePath(service.slug, "national-prefecture")}
                >
                  国・県で案を生成する
                </Link>
              </Button>
            </div>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-primary-dark">
              <Hourglass className="size-4" aria-hidden />
              了承待ち（このカテゴリ）
            </h3>
            <RuleList
              rules={pending}
              emptyLabel="このカテゴリの了承待ちはありません。"
            />
          </div>
          <div>
            <h3 className="mb-2 text-base font-semibold text-primary-dark">
              ルールブック登録済み
            </h3>
            <RuleList
              rules={approved}
              emptyLabel="このカテゴリの登録済みルールはまだありません。"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link href="/admin/rules/pending">
                横断のルール管理を開く
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
