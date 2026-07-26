import Link from "next/link"
import { BookMarked, ExternalLink, FileText, Link2 } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { ProposeRulesFromDocumentButton } from "@/components/features/admin/rules/propose-rules-from-document-button"
import {
  HUMAN_REVIEW_STATUS_LABEL,
  MATERIAL_CATEGORY_LABEL,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const LAYER_ORDER = ["national", "prefecture", "city"] as const

const LAYER_LABEL = {
  national: "国",
  prefecture: "県",
  city: "市",
} as const

type BookEntry =
  | {
      kind: "source"
      layer: (typeof LAYER_ORDER)[number]
      id: string
      title: string
      subtitle: string
      reviewLabel: string
      needsAttention: boolean
      url: string | null
    }
  | {
      kind: "document"
      layer: (typeof LAYER_ORDER)[number]
      id: string
      title: string
      subtitle: string
      reviewLabel: string
      needsAttention: boolean
      url: string | null
    }

type Props = {
  data: CityRulebookData
}

/**
 * 根拠（参照URL・行政資料）を国→県→市の折りたたみ一覧にまとめる。
 */
export function CityRulebookBookToc({ data }: Props) {
  const { city, sources, documents, counts } = data

  const entries: BookEntry[] = []

  for (const layer of LAYER_ORDER) {
    for (const s of sources.filter((x) => x.layer === layer)) {
      const needsAttention =
        s.human_review_status === "needs_review" ||
        s.human_review_status === "outdated" ||
        s.human_review_status === "unverified" ||
        !primarySourceUrl(s)
      entries.push({
        kind: "source",
        layer,
        id: s.id,
        title: s.title,
        subtitle: [
          s.jurisdictionName,
          s.material_category
            ? (MATERIAL_CATEGORY_LABEL[s.material_category] ??
              s.material_category)
            : null,
        ]
          .filter(Boolean)
          .join("／"),
        reviewLabel:
          HUMAN_REVIEW_STATUS_LABEL[s.human_review_status] ??
          s.human_review_status,
        needsAttention,
        url: primarySourceUrl(s),
      })
    }
    for (const d of documents.filter((x) => x.layer === layer)) {
      const needsAttention =
        d.last_sync_status === "failed" ||
        d.last_sync_status === "suspicious" ||
        d.last_sync_status === "selector_broken"
      entries.push({
        kind: "document",
        layer,
        id: d.id,
        title: d.title,
        subtitle: [
          d.jurisdiction_level,
          d.region_name,
          `${d.applicable_year}年度`,
          d.last_sync_status ? `同期:${d.last_sync_status}` : null,
        ]
          .filter(Boolean)
          .join("／"),
        reviewLabel: "行政資料（台帳）",
        needsAttention: Boolean(needsAttention),
        url: d.source_url ?? null,
      })
    }
  }

  const attentionCount = entries.filter((e) => e.needsAttention).length
  const totalItems =
    counts.citySources +
    counts.cityDocuments +
    counts.sharedSources +
    counts.sharedDocuments

  return (
    <section className="space-y-4" aria-labelledby="book-toc-heading">
      <Card className="rounded-xl border-primary/20 bg-primary/[0.02] shadow-subtle">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookMarked className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle
                  id="book-toc-heading"
                  className="text-xl text-primary-dark"
                >
                  自治体ルール設定
                </CardTitle>
                <CardDescription className="mt-1 text-base leading-relaxed">
                  チェックルールの元となる自治体公開情報URLの一覧です
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/admin/rules/source-urls?city=${city.slug}`}>
                  参照URLを編集する
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/admin/rules/documents?city=${city.slug}`}>
                  行政資料を編集する
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-md tabular-nums">
              合計 {totalItems}件
            </Badge>
            <Badge variant="outline" className="rounded-md tabular-nums">
              国・県 {counts.sharedSources + counts.sharedDocuments}件
            </Badge>
            <Badge variant="outline" className="rounded-md tabular-nums">
              {city.name} {counts.citySources + counts.cityDocuments}件
            </Badge>
            {attentionCount > 0 ? (
              <Badge variant="destructive" className="rounded-md tabular-nums">
                確認が必要 {attentionCount}件
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
          まだ根拠がありません。下の「参照URLを追加・修正する」か、行政資料の編集から登録してください。
        </p>
      ) : (
        <div className="space-y-2">
          {LAYER_ORDER.map((layer) => {
            const layerEntries = entries.filter((e) => e.layer === layer)
            const layerTitle =
              layer === "national"
                ? "国"
                : layer === "prefecture"
                  ? city.prefectureName
                  : city.name
            return (
              <details
                key={layer}
                className="rounded-xl border border-border bg-muted/20 px-4 py-3"
              >
                <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {layerTitle}
                  <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                    （{layerEntries.length}件）
                  </span>
                </summary>
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {layerEntries.length === 0 ? (
                    <p className="text-base text-muted-foreground">
                      登録はありません。
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {layerEntries.map((e, index) => (
                        <li key={`${e.kind}-${e.id}`}>
                          <Card className="rounded-xl shadow-subtle">
                            <CardContent className="flex flex-wrap items-center gap-3 py-3.5">
                              <span
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold tabular-nums text-muted-foreground"
                                aria-hidden
                              >
                                {index + 1}
                              </span>
                              <Badge variant="outline" className="rounded-md">
                                {LAYER_LABEL[e.layer]}
                              </Badge>
                              <Badge variant="secondary" className="rounded-md">
                                {e.kind === "source" ? (
                                  <>
                                    <Link2
                                      className="mr-1 size-3.5"
                                      aria-hidden
                                    />
                                    参照URL
                                  </>
                                ) : (
                                  <>
                                    <FileText
                                      className="mr-1 size-3.5"
                                      aria-hidden
                                    />
                                    行政資料
                                  </>
                                )}
                              </Badge>
                              {e.needsAttention ? (
                                <Badge
                                  variant="destructive"
                                  className="rounded-md"
                                >
                                  要確認
                                </Badge>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-primary-dark">
                                  {e.title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {e.subtitle}
                                  {e.kind === "source"
                                    ? `／${e.reviewLabel}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {e.url ? (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11"
                                  >
                                    <a
                                      href={e.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      原文を開く
                                      <ExternalLink
                                        className="size-4"
                                        aria-hidden
                                      />
                                    </a>
                                  </Button>
                                ) : null}
                                {e.kind === "document" ? (
                                  <ProposeRulesFromDocumentButton
                                    knowledgeDocumentId={e.id}
                                    documentTitle={e.title}
                                  />
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
