import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = { title: "自治体管理" }

/** 旧自治体マスタ → 訪問介護の市区町村ルール設定 */
export default function Page() {
  redirect("/admin/rules/services/homecare/municipalities")
}
