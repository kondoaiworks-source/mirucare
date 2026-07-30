import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await Promise.resolve(params)
  const city = getPhase1CityBySlug(slug)
  return {
    title: city ? `${city.name}のルールブック` : "ルールブック",
  }
}

/** 旧市ルールブック → 新階層の市設定 */
export default async function CityRulebookPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params)
  if (!getPhase1CityBySlug(slug)) {
    notFound()
  }
  redirect(`/admin/rules/services/homecare/municipalities/${slug}`)
}
