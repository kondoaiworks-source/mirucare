import type { Metadata } from "next"
import { LawsAdmin } from "@/components/features/admin/rules/laws-admin"

export const metadata: Metadata = { title: "法令・根拠" }

export default function Page() {
  return <LawsAdmin />
}
