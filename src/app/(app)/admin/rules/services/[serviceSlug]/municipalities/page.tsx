import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = { title: RULES_UI.municipalityMaster }

/** 旧・サービス配下の自治体設定 → 自治体マスタ */
export default async function MunicipalitiesForServiceRedirectPage() {
  redirect("/admin/rules/municipalities")
}
