import type { Metadata } from "next"
import { AiRulesAdmin } from "@/components/features/admin/rules/ai-rules-admin"

export const metadata: Metadata = { title: "AI判定ルール" }

type PageProps = {
  searchParams: { fromDraft?: string }
}

export default function Page({ searchParams }: PageProps) {
  return <AiRulesAdmin fromDraftId={searchParams.fromDraft} />
}
