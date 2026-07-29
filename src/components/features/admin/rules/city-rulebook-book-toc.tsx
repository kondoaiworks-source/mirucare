import Link from "next/link"
import {
  BookMarked,
  ExternalLink,
  FileText,
  Pencil,
} from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { CityRulebookSection } from "@/components/features/admin/rules/city-rulebook-section"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { ProposeRulesFromDocumentButton } from "@/components/features/admin/rules/propose-rules-from-document-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const LAYER_ORDER = ["national", "prefecture", "city"] as const

const LAYER_LABEL = {
  national: "国",
  prefecture: "県",
  city: "市",
} as const

type Props = {
  data: CityRulebookData
}

function documentEditHref(opts: { citySlug: string; layer: string }) {
  if (opts.layer === "city") {
    return `/admin/rules/documents?city=${opts.citySlug}`
  }
  return `/admin/rules/documents`
}

/**
 * 根拠（公開情報・公開情報監視）を国→県→市の折りたたみ一覧にまとめる。
 * 公開情報の追加・修正・削除は各レイヤ内で完結する。
 */
export function CityRulebookBookToc({ data }: Props) {
  const { city, layerJurisdictions, sources, documents } = data

  return (
    <CityRulebookSection
      headingId="book-toc-heading"
      icon={<BookMarked className="size-5" aria-hidden />}
      title="自治体ルール設定"
      countLabel={`（公開情報 ${sources.length}／公開情報監視 ${documents.length}）`}
      description="ルールブックの元になる国・県・市で公開している情報へのリンク先を設定してください。"
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/admin/rules/documents?city=${city.slug}`}>
            公開情報監視を開く
          </Link>
        </Button>
      }
    >
      <div className="space-y-2">
        {LAYER_ORDER.map((layer, layerIndex) => {
          const layerSources = sources.filter((s) => s.layer === layer)
          const layerDocuments = documents.filter((d) => d.layer === layer)
          const layerTitle =
            layer === "national"
              ? "国"
              : layer === "prefecture"
                ? city.prefectureName
                : city.name
          const jurisdiction = layerJurisdictions[layer]
          const totalCount = layerSources.length + layerDocuments.length

          return (
            <details
              key={layer}
              className="rounded-xl border border-border bg-muted/30 px-4 py-3"
              open={layer === "city" || totalCount > 0}
            >
              <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {layerTitle}
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  （{totalCount}件）
                </span>
              </summary>
              <div className="mt-4 space-y-6 border-t border-border pt-4">
                <CityRulebookSourcesPanel
                  layer={layer}
                  layerLabel={layerTitle}
                  jurisdictionId={jurisdiction?.id ?? null}
                  sources={layerSources}
                  showMonitoringAlert={layerIndex === 0}
                />

                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-base font-semibold text-primary-dark">
                    公開情報監視
                  </p>
                  {layerDocuments.length === 0 ? (
                    <p className="text-base text-muted-foreground">
                      台帳上の資料はありません。公開情報PDF（直リンク）を入れると自動で載ります。
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {layerDocuments.map((d, index) => {
                        const needsAttention =
                          d.last_sync_status === "failed" ||
                          d.last_sync_status === "suspicious" ||
                          d.last_sync_status === "selector_broken"
                        const url = d.source_url?.trim() || null
                        const subtitle = [
                          d.jurisdiction_level,
                          d.region_name,
                          `${d.applicable_year}年度`,
                          d.last_sync_status
                            ? `同期:${d.last_sync_status}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join("／")
                        return (
                          <li key={d.id}>
                            <Card
                              className={
                                needsAttention
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
                                  {LAYER_LABEL[layer]}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="rounded-md"
                                >
                                  <FileText
                                    className="mr-1 size-3.5"
                                    aria-hidden
                                  />
                                  台帳
                                </Badge>
                                {needsAttention || !url ? (
                                  <Badge
                                    variant="destructive"
                                    className="rounded-md"
                                  >
                                    {!url ? "URLなし／要修正" : "要確認"}
                                  </Badge>
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-primary-dark">
                                    {d.title}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {subtitle}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {url ? (
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="min-h-11"
                                    >
                                      <a
                                        href={url}
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
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11"
                                  >
                                    <Link
                                      href={documentEditHref({
                                        citySlug: city.slug,
                                        layer,
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
                                    knowledgeDocumentId={d.id}
                                    documentTitle={d.title}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          )
        })}
      </div>
    </CityRulebookSection>
  )
}
