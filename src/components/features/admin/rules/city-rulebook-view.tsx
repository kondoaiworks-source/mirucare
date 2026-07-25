import Link from "next/link"
import { BookOpen, ExternalLink, FileText, Link2 } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { CityRulebookAlertsPanel } from "@/components/features/admin/rules/city-rulebook-alerts-panel"
import { CityRulebookBookToc } from "@/components/features/admin/rules/city-rulebook-book-toc"
import { CityRulebookCheckRulesPanel } from "@/components/features/admin/rules/city-rulebook-check-rules-panel"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { ProposeRulesFromDocumentButton } from "@/components/features/admin/rules/propose-rules-from-document-button"
import { RulebookServiceSelect } from "@/components/features/admin/rules/rulebook-service-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"

const LAYER_LABEL = {
  national: "国",
  prefecture: "県",
  city: "市",
} as const

type Props = {
  data: CityRulebookData
}

export function CityRulebookView({ data }: Props) {
  const { city, jurisdiction, counts, sources, documents } = data

  const citySources = sources.filter((s) => s.layer === "city")
  const sharedSources = sources.filter((s) => s.layer !== "city")
  const cityDocs = documents.filter((d) => d.layer === "city")
  const sharedDocs = documents.filter((d) => d.layer !== "city")

  const cityDocsHref = `/admin/rules/documents?city=${city.slug}`

  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb
          items={[
            { label: "ルールブック設定", href: "/admin/rules/regulatory" },
            { label: `${city.name}ルールブック` },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
                {city.name}のルールブック
              </h1>
              <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
                国・{city.prefectureName}・{city.name}
                の根拠を束ねた確定版です。更新アラートは人が確認してから最新にします。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHASE1_CITIES.map((c) => (
              <Button
                key={c.slug}
                asChild
                size="sm"
                variant={c.slug === city.slug ? "default" : "outline"}
                className="min-h-11"
              >
                <Link href={`/admin/rules/regulatory/${c.slug}`}>{c.name}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <RulebookServiceSelect />

      <PurposeGuide
        purpose={`${city.name}で選んだサービス（いまは訪問介護）を運営するときのルールブックです。目次で全体を確認し、更新アラートと参照URLはこの画面で扱えます。`}
        steps={[
          "チェック用の中身（了承済み判定ルール）を確認する",
          "更新アラートがあれば判定ルール案を生成→承認待ちで了承する",
          "足りない参照URL・行政資料を追加する",
        ]}
      />

      <CityRulebookCheckRulesPanel
        cityName={city.name}
        approved={data.approvedCheckRules}
        pending={data.pendingCheckRules}
      />

      <CityRulebookBookToc data={data} />

      <CityRulebookAlertsPanel
        citySlug={city.slug}
        cityName={city.name}
        pendingDrafts={data.pendingDrafts}
        openAlerts={data.openAlerts}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CountCard
          label="了承済み判定ルール"
          value={counts.approvedCheckRules}
        />
        <CountCard
          label="承認待ちの判定ルール案"
          value={counts.pendingCheckRules}
        />
        <CountCard label={`${city.name}の参照URL`} value={counts.citySources} />
        <CountCard
          label={`${city.name}の行政資料`}
          value={counts.cityDocuments}
        />
        <CountCard label="国・県の参照URL" value={counts.sharedSources} />
        <CountCard label="国・県の行政資料" value={counts.sharedDocuments} />
      </section>

      <CityRulebookSourcesPanel
        citySlug={city.slug}
        cityName={city.name}
        jurisdictionId={jurisdiction.id}
        sources={citySources}
      />

      <ResourceSection
        title={`${city.name}の行政資料`}
        description="この市のマニュアルPDFなど。スナップショットがある資料は「判定ルール案を生成する」で初回のチェック用中身を提案できます。"
        editHref={cityDocsHref}
        editLabel="この市の行政資料を編集する"
        empty="まだ登録がありません。行政資料から追加し、判定ルール案を生成してください。"
        icon={FileText}
        itemCount={cityDocs.length}
      >
        {cityDocs.map((d) => (
          <DocumentRow key={d.id} doc={d} />
        ))}
      </ResourceSection>

      <ResourceSection
        title="共有：国・県の参照URL"
        description={`${city.prefectureName}と国の根拠も、この市のルールブックに含みます。市固有の追加は上の参照URLから。`}
        editHref="/admin/rules/source-urls"
        editLabel="参照URLを編集する"
        empty="国・県の参照URLはまだありません。"
        icon={Link2}
        itemCount={sharedSources.length}
      >
        {sharedSources.map((s) => (
          <SharedSourceRow key={s.id} source={s} />
        ))}
      </ResourceSection>

      <ResourceSection
        title="共有：国・県の行政資料"
        description="全市で共有する層です。"
        editHref="/admin/rules/documents"
        editLabel="行政資料を編集する"
        empty="国・県の行政資料はまだありません。"
        icon={FileText}
        itemCount={sharedDocs.length}
      >
        {sharedDocs.map((d) => (
          <DocumentRow key={d.id} doc={d} />
        ))}
      </ResourceSection>

      <p className="text-sm leading-relaxed text-muted-foreground">
        判定ルール（どう疑うか）の変更は{" "}
        <Link
          href="/admin/rules/ai-rules"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          詳細設定の判定ルール
        </Link>
        と承認待ちで行います。台帳への反映だけではチェック基準は変わりません。
      </p>
    </div>
  )
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-xl shadow-subtle">
      <CardHeader className="pb-2">
        <CardDescription className="text-base">{label}</CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums text-primary-dark">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function ResourceSection({
  title,
  description,
  editHref,
  editLabel,
  empty,
  icon: Icon,
  children,
  itemCount,
}: {
  title: string
  description: string
  editHref: string
  editLabel: string
  empty: string
  icon: typeof FileText | typeof Link2
  children: React.ReactNode
  itemCount: number
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-primary-dark">
            <Icon className="size-5 text-primary" aria-hidden />
            {title}
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={editHref}>{editLabel}</Link>
        </Button>
      </div>
      {itemCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-base text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}

function SharedSourceRow({
  source,
}: {
  source: CityRulebookData["sources"][number]
}) {
  const url =
    source.direct_file_url?.trim() ||
    source.parent_page_url?.trim() ||
    source.official_url?.trim() ||
    null
  return (
    <li>
      <Card className="rounded-xl shadow-subtle">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Badge variant="outline" className="rounded-md">
            {LAYER_LABEL[source.layer]}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary-dark">{source.title}</p>
            <p className="text-sm text-muted-foreground">
              {source.jurisdictionName}
              {source.material_category ? `／${source.material_category}` : ""}
            </p>
          </div>
          {url ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <a href={url} target="_blank" rel="noopener noreferrer">
                原文を開く
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">URL未設定</span>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

function DocumentRow({
  doc,
}: {
  doc: CityRulebookData["documents"][number]
}) {
  return (
    <li>
      <Card className="rounded-xl shadow-subtle">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Badge variant="outline" className="rounded-md">
            {LAYER_LABEL[doc.layer]}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary-dark">{doc.title}</p>
            <p className="text-sm text-muted-foreground">
              {doc.jurisdiction_level}
              {doc.region_name ? `／${doc.region_name}` : ""}／
              {doc.applicable_year}年度
              {doc.last_sync_status ? `／同期:${doc.last_sync_status}` : ""}
            </p>
          </div>
          {doc.source_url ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
                原文を開く
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          ) : null}
          <ProposeRulesFromDocumentButton
            knowledgeDocumentId={doc.id}
            documentTitle={doc.title}
          />
        </CardContent>
      </Card>
    </li>
  )
}
