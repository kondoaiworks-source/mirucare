import Link from "next/link"
import {
  BookMarked,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
} from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { CityRulebookSection } from "@/components/features/admin/rules/city-rulebook-section"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { ProposeRulesFromDocumentButton } from "@/components/features/admin/rules/propose-rules-from-document-button"
import {
  HUMAN_REVIEW_STATUS_LABEL,
  MATERIAL_CATEGORY_LABEL,
  primarySourceUrl,
} from "@/lib/rule-engine/source-urls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
      jurisdictionId: string
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

function sourceEditHref(opts: {
  citySlug: string
  sourceId: string
  jurisdictionId: string
}) {
  const params = new URLSearchParams({
    city: opts.citySlug,
    jurisdiction: opts.jurisdictionId,
    edit: opts.sourceId,
  })
  return `/admin/rules/source-urls?${params.toString()}`
}

function documentEditHref(opts: { citySlug: string; layer: string }) {
  if (opts.layer === "city") {
    return `/admin/rules/documents?city=${opts.citySlug}`
  }
  return `/admin/rules/documents`
}

/**
 * 根拠（参照URL・行政資料）を国→県→市の折りたたみ一覧にまとめる。
 * 市レイヤ内で参照URLの追加・修正も行う。
 */
export function CityRulebookBookToc({ data }: Props) {
  const { city, jurisdiction, sources, documents } = data

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
        jurisdictionId: s.jurisdiction_id,
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

  const citySources = sources.filter((s) => s.layer === "city")

  return (
    <CityRulebookSection
      headingId="book-toc-heading"
      icon={<BookMarked className="size-5" aria-hidden />}
      title="自治体ルール設定"
      countLabel={`（${entries.length}件）`}
      description="チェックルールの元となる自治体公開情報URLの一覧です。更新アラートにはPDF直リンクが必要です。"
      action={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/admin/rules/source-urls?city=${city.slug}`}>
              <Pencil className="size-4" aria-hidden />
              参照URLを修正する
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/admin/rules/documents?city=${city.slug}`}>
              行政資料を編集する
            </Link>
          </Button>
        </div>
      }
    >
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
              className="rounded-xl border border-border bg-muted/30 px-4 py-3"
            >
              <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {layerTitle}
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  （{layerEntries.length}件）
                </span>
              </summary>
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                {layerEntries.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    登録はありません。
                    {layer === "city" ? null : (
                      <>
                        {" "}
                        <Link
                          href={
                            layer === "national"
                              ? "/admin/rules/source-urls"
                              : `/admin/rules/source-urls?city=${city.slug}`
                          }
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          参照URL画面で追加・修正する
                        </Link>
                      </>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {layerEntries.map((e, index) => (
                      <li key={`${e.kind}-${e.id}`}>
                        <Card
                          className={
                            e.needsAttention || !e.url
                              ? "rounded-xl border-warning/40 shadow-subtle"
                              : "rounded-xl shadow-subtle"
                          }
                        >
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
                            {e.needsAttention || !e.url ? (
                              <Badge
                                variant="destructive"
                                className="rounded-md"
                              >
                                {!e.url ? "URLなし／要修正" : "要確認"}
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
                              {e.kind === "source" ? (
                                <Button
                                  asChild
                                  variant={
                                    e.needsAttention || !e.url
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="min-h-11"
                                >
                                  <Link
                                    href={sourceEditHref({
                                      citySlug: city.slug,
                                      sourceId: e.id,
                                      jurisdictionId: e.jurisdictionId,
                                    })}
                                  >
                                    <Pencil
                                      className="size-4"
                                      aria-hidden
                                    />
                                    URLを修正する
                                  </Link>
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11"
                                  >
                                    <Link
                                      href={documentEditHref({
                                        citySlug: city.slug,
                                        layer: e.layer,
                                      })}
                                    >
                                      <Pencil
                                        className="size-4"
                                        aria-hidden
                                      />
                                      資料を修正する
                                    </Link>
                                  </Button>
                                  <ProposeRulesFromDocumentButton
                                    knowledgeDocumentId={e.id}
                                    documentTitle={e.title}
                                  />
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}

                {layer === "city" ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="text-base font-semibold text-primary-dark">
                      この市の参照URLを追加・修正する
                    </p>
                    <CityRulebookSourcesPanel
                      citySlug={city.slug}
                      cityName={city.name}
                      jurisdictionId={jurisdiction.id}
                      sources={citySources}
                      embedded
                    />
                  </div>
                ) : null}
              </div>
            </details>
          )
        })}
      </div>
    </CityRulebookSection>
  )
}
