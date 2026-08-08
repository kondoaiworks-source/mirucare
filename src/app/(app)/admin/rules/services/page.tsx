import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "利用設定",
}

/** 旧「介護サービス選定」一覧 → 利用設定ハブへ */
export default function ServicesPage() {
  redirect("/admin/rules/setup")
}
