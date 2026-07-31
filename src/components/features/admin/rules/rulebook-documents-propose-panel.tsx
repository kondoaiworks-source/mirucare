import Link from "next/link"
import { ExternalLink, FileText, Pencil } from "lucide-react"
import type { CityRulebookDocument } from "@/app/actions/city-rulebook"
import { ProposeRulesFromDocumentButton } from "@/components/features/admin/rules/propose-rules-from-document-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const LAYER_LABEL = {
  national: "国",
  prefecture: "県",
  city: "市",
} as const

type Props = {
  documents: CityRulebookDocument[]
  citySlug: string
  /** 見出し文言 */
  heading?: string
  description?: string
}

/**
 * 台帳上の公開情報から判定ルール案を生成する一覧。
 * URL登録だけでは案は出ないため、ここから人が明示的に生成する。
 */
export function RulebookDocumentsProposePanel({
  documents,
  citySlug,
  heading = "判定ルール案の生成",
  description = "台帳に本文がある資料から、AIが判定ルール案＋根拠を提案します。生成後は「ルール管理」で了承するまでチェックには使われません。",
}: Props) {
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-subtle"
      aria-labelledby="propose-rules-heading"
    >
      <div>
        <h2
          id="propose-rules-heading"
          className="text-lg font-semibold text-primary-dark"
        >
          {heading}
        </h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="text-base leading-relaxed text-muted-foreground">
          台帳上の資料がありません。公開情報PDF（直リンク）を登録すると自動で載ります。載ったあと、下のボタンで案を生成できます。
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d, index) => {
            const needsAttention =
              d.last_sync_status === "failed" ||
              d.last_sync_status === "suspicious" ||
              d.last_sync_status === "selector_broken"
            const url = d.source_url?.trim() || null
            const hasSnapshot = Boolean(d.content_hash?.trim())
            const subtitle = [
              LAYER_LABEL[d.layer],
              d.region_name,
              `${d.applicable_year}年度`,
              d.last_sync_status ? `同期:${d.last_sync_status}` : null,
              hasSnapshot ? "本文あり" : "本文なし",
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
                    <FileText
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-primary-dark">{d.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {subtitle}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="rounded-md">
                          {LAYER_LABEL[d.layer]}
                        </Badge>
                        {hasSnapshot ? (
                          <Badge className="rounded-md bg-primary/15 text-primary-dark">
                            生成可能
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md">
                            先に同期が必要
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {url ? (
                        <Button asChild variant="outline" className="min-h-11">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            原文を開く
                            <ExternalLink className="size-4" aria-hidden />
                          </a>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" className="min-h-11">
                        <Link
                          href={
                            d.layer === "city"
                              ? `/admin/rules/documents?city=${citySlug}`
                              : "/admin/rules/documents"
                          }
                        >
                          <Pencil className="size-4" aria-hidden />
                          資料を確認する
                        </Link>
                      </Button>
                      {hasSnapshot ? (
                        <ProposeRulesFromDocumentButton
                          knowledgeDocumentId={d.id}
                          documentTitle={d.title}
                        />
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild className="min-h-11">
          <Link href="/admin/rules/pending">ルール管理で了承する</Link>
        </Button>
      </div>
    </section>
  )
}
